import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CreateKnowledgeItemUseCase } from "./CreateKnowledgeItemUseCase.ts";
import { CreateKnowledgeItemCommand } from "../command/CreateKnowledgeItemCommand.ts";
import {
  FakeKnowledgeItemRepository,
  FakeCollectionRepository,
  FakeTagRepository,
  FakeKnowledgeVersionRepository,
} from "../testDoubles/index.ts";
import { Collection } from "../../domain/aggregates/Collection.ts";
import { CollectionId } from "../../domain/identifiers/CollectionId.ts";
import { Tag } from "../../domain/aggregates/Tag.ts";
import { TagId } from "../../domain/identifiers/TagId.ts";
import { runWithActor } from "../../../../shared/application/context/ActorContext.ts";

const CURATOR = { companyId: "company-1", actorId: "curator-1", actorType: "user" as const, roles: ["curator" as const] };

async function build() {
  const collectionRepository = new FakeCollectionRepository();
  await collectionRepository.save(Collection.create(new CollectionId("c1"), "company-1", "Policies", null, "admin"));
  const tagRepository = new FakeTagRepository();
  await tagRepository.save(Tag.createTenantTag(new TagId("t1"), "company-1", "Refunds"));
  const versionRepository = new FakeKnowledgeVersionRepository();
  const useCase = new CreateKnowledgeItemUseCase(
    new FakeKnowledgeItemRepository(),
    collectionRepository,
    tagRepository,
    versionRepository,
    () => new Date("2026-06-16T00:00:00.000Z"),
  );
  return { useCase, versionRepository };
}

describe("CreateKnowledgeItemUseCase", () => {
  it("requires the curator role", async () => {
    const { useCase } = await build();
    assert.deepEqual([...useCase.requiredRoles], ["curator"]);
  });

  it("creates a draft item and appends version 1", async () => {
    const { useCase, versionRepository } = await build();
    const command = CreateKnowledgeItemCommand.of("i1", "c1", "Refund policy", "Body", ["t1"], "internal");

    const item = await runWithActor(CURATOR, () => useCase.execute(command));

    assert.equal(item.status, "draft");
    assert.equal(item.companyId, "company-1");
    assert.equal(item.authorId, "curator-1");
    assert.equal(versionRepository.appended.length, 1);
    assert.equal(versionRepository.appended[0]!.versionNumber, 1);
  });

  it("rejects an unknown collection", async () => {
    const { useCase } = await build();
    const command = CreateKnowledgeItemCommand.of("i1", "missing", "T", "B", ["t1"], "internal");

    await assert.rejects(() => runWithActor(CURATOR, () => useCase.execute(command)), /Collection not found/);
  });

  it("rejects an unknown tag", async () => {
    const { useCase } = await build();
    const command = CreateKnowledgeItemCommand.of("i1", "c1", "T", "B", ["ghost"], "internal");

    await assert.rejects(() => runWithActor(CURATOR, () => useCase.execute(command)), /Unknown tag/);
  });
});
