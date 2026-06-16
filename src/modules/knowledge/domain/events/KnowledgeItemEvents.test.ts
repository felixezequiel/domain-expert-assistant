import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  KnowledgeItemDraftedEvent,
  KnowledgeItemEditedEvent,
  KnowledgeItemRetaggedEvent,
  KnowledgeItemMovedToCollectionEvent,
  KnowledgeItemSubmittedForReviewEvent,
  KnowledgeItemRejectedEvent,
  KnowledgeItemPublishedEvent,
  KnowledgeItemDeprecatedEvent,
  KnowledgeItemArchivedEvent,
  KnowledgeItemRolledBackEvent,
} from "./KnowledgeItemEvents.ts";

describe("KnowledgeItemEvents", () => {
  it("names each event and carries its payload", () => {
    assert.equal(new KnowledgeItemDraftedEvent("i", "T", "c", 1).eventName, "KnowledgeItemDrafted");
    assert.equal(new KnowledgeItemDraftedEvent("i", "T", "c", 1).collectionId, "c");
    assert.equal(new KnowledgeItemEditedEvent("i", 2).versionNumber, 2);
    assert.equal(new KnowledgeItemRetaggedEvent("i", 3).eventName, "KnowledgeItemRetagged");
    assert.equal(new KnowledgeItemMovedToCollectionEvent("i", "c2").collectionId, "c2");
    assert.equal(new KnowledgeItemSubmittedForReviewEvent("i").eventName, "KnowledgeItemSubmittedForReview");
    assert.equal(new KnowledgeItemRejectedEvent("i", "needs work").reason, "needs work");
    assert.equal(new KnowledgeItemPublishedEvent("i", 2).publishedVersion, 2);
    assert.equal(new KnowledgeItemDeprecatedEvent("i").eventName, "KnowledgeItemDeprecated");
    assert.equal(new KnowledgeItemArchivedEvent("i").eventName, "KnowledgeItemArchived");

    const rolledBack = new KnowledgeItemRolledBackEvent("i", 1, 4);
    assert.equal(rolledBack.restoredFromVersion, 1);
    assert.equal(rolledBack.versionNumber, 4);
  });

  it("stamps the envelope as null until enriched", () => {
    assert.equal(new KnowledgeItemPublishedEvent("i", 1).companyId, null);
  });
});
