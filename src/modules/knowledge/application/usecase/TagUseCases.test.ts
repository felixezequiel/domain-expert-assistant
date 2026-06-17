import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CreateTenantTagUseCase, RemoveTenantTagUseCase } from "./TagUseCases.ts";
import { CreateTenantTagCommand, RemoveTenantTagCommand } from "../command/TagCommands.ts";
import { FakeTagRepository, FakeKnowledgeItemRepository } from "../testDoubles/index.ts";
import { KnowledgeItem } from "../../domain/aggregates/KnowledgeItem.ts";
import { KnowledgeItemId } from "../../domain/identifiers/KnowledgeItemId.ts";
import { CollectionId } from "../../domain/identifiers/CollectionId.ts";
import { Tag } from "../../domain/aggregates/Tag.ts";
import { TagId } from "../../domain/identifiers/TagId.ts";
import { Title } from "../../domain/valueObjects/Title.ts";
import { KnowledgeBody } from "../../domain/valueObjects/KnowledgeBody.ts";
import { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";
import { runWithActor } from "../../../../shared/application/context/ActorContext.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

const ADMIN = { companyId: "company-1", actorId: "admin-1", actorType: "user" as const, roles: ["admin" as const] };

describe("TagUseCases", () => {
  it("creates a tenant tag", async () => {
    const repo = new FakeTagRepository();
    const useCase = new CreateTenantTagUseCase(repo);

    const tag = await runWithActor(ADMIN, () => useCase.execute(CreateTenantTagCommand.of("t1", "Refund Policy")));

    assert.equal(tag.slug, "refund-policy");
    assert.equal(tag.companyId, "company-1");
  });

  it("rejects a duplicate slug", async () => {
    const repo = new FakeTagRepository();
    await repo.save(Tag.createTenantTag(new TagId("t0"), "company-1", "Refund Policy"));
    const useCase = new CreateTenantTagUseCase(repo);

    await assert.rejects(
      () => runWithActor(ADMIN, () => useCase.execute(CreateTenantTagCommand.of("t1", "Refund Policy"))),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, "knowledge.tagSlugExists");
        assert.equal(error.kind, "validation");
        assert.deepEqual(error.params, { slug: "refund-policy" });
        assert.equal(error.message, "A tag with this slug already exists: refund-policy");
        return true;
      },
    );
  });

  it("removes an unused tenant tag and blocks one in use", async () => {
    const tagRepository = new FakeTagRepository();
    await tagRepository.save(Tag.createTenantTag(new TagId("t1"), "company-1", "Refunds"));
    const itemRepository = new FakeKnowledgeItemRepository();
    const useCase = new RemoveTenantTagUseCase(tagRepository, itemRepository);

    const removed = await useCase.execute(RemoveTenantTagCommand.of("t1"));
    assert.equal(removed.isMarkedForDeletion(), true);

    // now make the tag in use
    await tagRepository.save(Tag.createTenantTag(new TagId("t2"), "company-1", "InUse"));
    await itemRepository.save(
      KnowledgeItem.create(
        new KnowledgeItemId("i1"),
        "company-1",
        new CollectionId("c1"),
        new Title("T"),
        new KnowledgeBody("B"),
        [new TagId("t2")],
        SensitivityLevel.of("internal"),
        "author-1",
      ),
    );
    await assert.rejects(
      () => useCase.execute(RemoveTenantTagCommand.of("t2")),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, "knowledge.tagInUse");
        assert.equal(error.kind, "validation");
        assert.equal(error.message, "Cannot remove a tag that is in use");
        return true;
      },
    );
  });
});
