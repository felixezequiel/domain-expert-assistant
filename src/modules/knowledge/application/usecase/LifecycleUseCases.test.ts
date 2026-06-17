import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SubmitForReviewUseCase,
  ApproveItemUseCase,
  RejectItemUseCase,
  DeprecateItemUseCase,
  ArchiveItemUseCase,
} from "./LifecycleUseCases.ts";
import {
  SubmitForReviewCommand,
  ApproveItemCommand,
  RejectItemCommand,
  DeprecateItemCommand,
  ArchiveItemCommand,
} from "../command/LifecycleCommands.ts";
import { FakeKnowledgeItemRepository, FakeOrganizationPolicy } from "../testDoubles/index.ts";
import { KnowledgeItem } from "../../domain/aggregates/KnowledgeItem.ts";
import { KnowledgeItemId } from "../../domain/identifiers/KnowledgeItemId.ts";
import { CollectionId } from "../../domain/identifiers/CollectionId.ts";
import { TagId } from "../../domain/identifiers/TagId.ts";
import { Title } from "../../domain/valueObjects/Title.ts";
import { KnowledgeBody } from "../../domain/valueObjects/KnowledgeBody.ts";
import { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";
import { runWithActor } from "../../../../shared/application/context/ActorContext.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

const REVIEWER = { companyId: "company-1", actorId: "reviewer-1", actorType: "user" as const, roles: ["reviewer" as const] };

function item(authorId = "author-1"): KnowledgeItem {
  return KnowledgeItem.create(
    new KnowledgeItemId("i1"),
    "company-1",
    new CollectionId("c1"),
    new Title("T"),
    new KnowledgeBody("B"),
    [new TagId("t1")],
    SensitivityLevel.of("internal"),
    authorId,
  );
}

async function repoWith(prepared: KnowledgeItem): Promise<FakeKnowledgeItemRepository> {
  const repo = new FakeKnowledgeItemRepository();
  await repo.save(prepared);
  return repo;
}

describe("Lifecycle use cases", () => {
  it("submits a draft for review", async () => {
    const repo = await repoWith(item());
    const result = await new SubmitForReviewUseCase(repo).execute(SubmitForReviewCommand.of("i1"));
    assert.equal(result.status, "in_review");
  });

  it("approves an in-review item, publishing it", async () => {
    const prepared = item();
    prepared.submitForReview();
    const repo = await repoWith(prepared);
    const useCase = new ApproveItemUseCase(repo, new FakeOrganizationPolicy(false));

    const result = await runWithActor(REVIEWER, () => useCase.execute(ApproveItemCommand.of("i1")));

    assert.equal(result.status, "published");
    assert.equal(result.publishedVersionNumber, 1);
  });

  it("blocks self-approval when requireSeparateReviewer is on", async () => {
    const prepared = item("reviewer-1"); // author == reviewer
    prepared.submitForReview();
    const repo = await repoWith(prepared);
    const useCase = new ApproveItemUseCase(repo, new FakeOrganizationPolicy(true));

    await assert.rejects(
      () => runWithActor(REVIEWER, () => useCase.execute(ApproveItemCommand.of("i1"))),
      /different from the author/,
    );
  });

  it("rejects an in-review item back to draft", async () => {
    const prepared = item();
    prepared.submitForReview();
    const repo = await repoWith(prepared);
    const result = await new RejectItemUseCase(repo).execute(RejectItemCommand.of("i1", "needs sources"));
    assert.equal(result.status, "draft");
  });

  it("deprecates then archives a published item", async () => {
    const prepared = item();
    prepared.submitForReview();
    prepared.approve("reviewer-1", false);
    const repo = await repoWith(prepared);

    const deprecated = await new DeprecateItemUseCase(repo).execute(DeprecateItemCommand.of("i1"));
    assert.equal(deprecated.status, "deprecated");

    const archived = await new ArchiveItemUseCase(repo).execute(ArchiveItemCommand.of("i1"));
    assert.equal(archived.status, "archived");
    assert.equal(archived.isServed(), false);
  });

  it("throws when the item does not exist", async () => {
    const repo = new FakeKnowledgeItemRepository();
    await assert.rejects(
      () => new SubmitForReviewUseCase(repo).execute(SubmitForReviewCommand.of("ghost")),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, "knowledge.itemNotFound");
        assert.equal(error.kind, "validation");
        assert.deepEqual(error.params, { id: "ghost" });
        assert.equal(error.message, "Knowledge item not found: ghost");
        return true;
      },
    );
  });
});
