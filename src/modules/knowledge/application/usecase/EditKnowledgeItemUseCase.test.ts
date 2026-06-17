import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EditKnowledgeItemUseCase } from "./EditKnowledgeItemUseCase.ts";
import { EditKnowledgeItemCommand } from "../command/EditKnowledgeItemCommand.ts";
import { FakeKnowledgeItemRepository, FakeKnowledgeVersionRepository } from "../testDoubles/index.ts";
import { KnowledgeItem } from "../../domain/aggregates/KnowledgeItem.ts";
import { KnowledgeItemId } from "../../domain/identifiers/KnowledgeItemId.ts";
import { CollectionId } from "../../domain/identifiers/CollectionId.ts";
import { TagId } from "../../domain/identifiers/TagId.ts";
import { Title } from "../../domain/valueObjects/Title.ts";
import { KnowledgeBody } from "../../domain/valueObjects/KnowledgeBody.ts";
import { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";
import { runWithActor } from "../../../../shared/application/context/ActorContext.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

const CURATOR = { companyId: "company-1", actorId: "curator-2", actorType: "user" as const, roles: ["curator" as const] };

function publishedItem(): KnowledgeItem {
  const item = KnowledgeItem.create(
    new KnowledgeItemId("i1"),
    "company-1",
    new CollectionId("c1"),
    new Title("T"),
    new KnowledgeBody("B"),
    [new TagId("t1")],
    SensitivityLevel.of("internal"),
    "author-1",
  );
  item.submitForReview();
  item.approve("reviewer-1", false);
  return item;
}

describe("EditKnowledgeItemUseCase", () => {
  it("edits a published item into a new draft version, keeping it served, appending a snapshot", async () => {
    const itemRepository = new FakeKnowledgeItemRepository();
    await itemRepository.save(publishedItem());
    const versionRepository = new FakeKnowledgeVersionRepository();
    const useCase = new EditKnowledgeItemUseCase(itemRepository, versionRepository, () => new Date("2026-06-16T00:00:00.000Z"));

    const result = await runWithActor(CURATOR, () =>
      useCase.execute(EditKnowledgeItemCommand.of("i1", "New title", "New body", "confidential", ["t1"])),
    );

    assert.equal(result.status, "draft");
    assert.equal(result.currentVersionNumber, 2);
    assert.equal(result.publishedVersionNumber, 1); // still serving v1
    assert.equal(result.isServed(), true);
    assert.equal(versionRepository.appended.length, 1);
    assert.equal(versionRepository.appended[0]!.versionNumber, 2);
  });

  it("throws when the item is missing", async () => {
    const useCase = new EditKnowledgeItemUseCase(new FakeKnowledgeItemRepository(), new FakeKnowledgeVersionRepository());
    await assert.rejects(
      () => runWithActor(CURATOR, () => useCase.execute(EditKnowledgeItemCommand.of("ghost", "T", "B", "internal", []))),
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
