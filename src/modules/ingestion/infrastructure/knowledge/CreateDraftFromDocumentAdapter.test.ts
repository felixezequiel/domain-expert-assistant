import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CreateDraftFromDocumentAdapter } from "./CreateDraftFromDocumentAdapter.ts";
import { CreateKnowledgeItemUseCase } from "../../../knowledge/application/usecase/CreateKnowledgeItemUseCase.ts";
import {
  FakeKnowledgeItemRepository,
  FakeCollectionRepository,
  FakeTagRepository,
  FakeKnowledgeVersionRepository,
} from "../../../knowledge/application/testDoubles/index.ts";
import { Collection } from "../../../knowledge/domain/aggregates/Collection.ts";
import { CollectionId } from "../../../knowledge/domain/identifiers/CollectionId.ts";
import { runWithActor } from "../../../../shared/application/context/ActorContext.ts";

describe("CreateDraftFromDocumentAdapter", () => {
  it("creates a Knowledge draft item from the document and returns its id", async () => {
    const collectionRepository = new FakeCollectionRepository();
    await collectionRepository.save(Collection.create(new CollectionId("col-1"), "company-1", "Policies", null, "admin"));
    const versionRepository = new FakeKnowledgeVersionRepository();
    const createKnowledgeItem = new CreateKnowledgeItemUseCase(
      new FakeKnowledgeItemRepository(),
      collectionRepository,
      new FakeTagRepository(),
      versionRepository,
      () => new Date("2026-06-16T00:00:00.000Z"),
    );
    const adapter = new CreateDraftFromDocumentAdapter(createKnowledgeItem);

    // The worker provides the tenant/system actor context the underlying use case reads.
    const itemId = await runWithActor(
      { companyId: "company-1", actorId: "system", actorType: "system" },
      () =>
        adapter.createDraftFromDocument({
          companyId: "company-1",
          collectionId: "col-1",
          title: "policy.md",
          body: "# Extracted body",
          createdBy: "system",
          causationId: "job-1",
        }),
    );

    assert.equal(typeof itemId, "string");
    assert.equal(versionRepository.appended.length, 1);
    assert.equal(versionRepository.appended[0]!.body, "# Extracted body");
    assert.equal(versionRepository.appended[0]!.itemId, itemId);
  });
});
