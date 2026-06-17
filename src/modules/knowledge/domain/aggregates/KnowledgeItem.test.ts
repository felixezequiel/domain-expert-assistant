import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { KnowledgeItem } from "./KnowledgeItem.ts";
import { KnowledgeItemId } from "../identifiers/KnowledgeItemId.ts";
import { CollectionId } from "../identifiers/CollectionId.ts";
import { TagId } from "../identifiers/TagId.ts";
import { Title } from "../valueObjects/Title.ts";
import { KnowledgeBody } from "../valueObjects/KnowledgeBody.ts";
import { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

function title(value = "Refund policy"): Title {
  return new Title(value);
}
function body(value = "Body content"): KnowledgeBody {
  return new KnowledgeBody(value);
}
const INTERNAL = SensitivityLevel.of("internal");

function draftItem(authorId = "author-1"): KnowledgeItem {
  return KnowledgeItem.create(
    new KnowledgeItemId("item-1"),
    "company-1",
    new CollectionId("col-1"),
    title(),
    body(),
    [new TagId("tag-1")],
    INTERNAL,
    authorId,
  );
}

function lastEvent(item: KnowledgeItem): string {
  const events = item.getDomainEvents();
  return events[events.length - 1]!.eventName;
}

describe("KnowledgeItem lifecycle", () => {
  it("is created as a draft v1, not yet served", () => {
    const item = draftItem();
    assert.equal(item.status, "draft");
    assert.equal(item.currentVersionNumber, 1);
    assert.equal(item.publishedVersionNumber, null);
    assert.equal(item.isServed(), false);
    assert.equal(item.getDomainEvents()[0]!.eventName, "KnowledgeItemDrafted");
  });

  it("follows the happy path draft → submit → approve → published and serves", () => {
    const item = draftItem();
    item.submitForReview();
    assert.equal(item.status, "in_review");

    item.approve("reviewer-1", true);
    assert.equal(item.status, "published");
    assert.equal(item.publishedVersionNumber, 1);
    assert.equal(item.isServed(), true);
    assert.equal(lastEvent(item), "KnowledgeItemPublished");
  });

  it("enforces reviewer ≠ author when the policy requires it", () => {
    const item = draftItem("author-1");
    item.submitForReview();

    assert.throws(() => item.approve("author-1", true), /different from the author/);
    assert.doesNotThrow(() => item.approve("author-1", false));
  });

  it("throws coded DomainErrors for the lifecycle invariants", () => {
    const forReviewer = draftItem("author-1");
    forReviewer.submitForReview();
    assert.throws(
      () => forReviewer.approve("author-1", true),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, "knowledge.approvalRequiresSeparateReviewer");
        assert.equal(error.kind, "validation");
        assert.equal(error.message, "Approval requires a reviewer different from the author/last editor");
        return true;
      },
    );

    const forReason = draftItem();
    forReason.submitForReview();
    assert.throws(
      () => forReason.reject("   "),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, "knowledge.rejectionReasonRequired");
        assert.equal(error.kind, "validation");
        assert.equal(error.message, "A rejection reason is required");
        return true;
      },
    );

    assert.throws(
      () => draftItem().deprecate(),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, "knowledge.invalidStatusTransition");
        assert.equal(error.kind, "validation");
        assert.deepEqual(error.params, { action: "deprecate", status: "draft" });
        assert.equal(error.message, "Cannot deprecate a knowledge item in status 'draft'");
        return true;
      },
    );

    const published = draftItem();
    published.submitForReview();
    published.approve("reviewer-1", true);
    published.archive();
    assert.throws(
      () => published.moveToCollection(new CollectionId("c")),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, "knowledge.cannotModifyArchived");
        assert.equal(error.kind, "validation");
        assert.deepEqual(error.params, { action: "move to another collection" });
        assert.equal(error.message, "Cannot move to another collection an archived knowledge item");
        return true;
      },
    );
  });

  it("keeps the published version serving while a new revision is edited (ADR-012)", () => {
    const item = draftItem();
    item.submitForReview();
    item.approve("reviewer-1", true); // published v1

    item.edit(title("Refund policy v2"), body("New body"), INTERNAL, [new TagId("tag-1")], "author-1");

    assert.equal(item.status, "draft"); // working version is a new draft
    assert.equal(item.currentVersionNumber, 2);
    assert.equal(item.publishedVersionNumber, 1); // v1 still serving
    assert.equal(item.isServed(), true);
    assert.equal(lastEvent(item), "KnowledgeItemEdited");
  });

  it("moves the published pointer only on approval of the new revision", () => {
    const item = draftItem();
    item.submitForReview();
    item.approve("reviewer-1", true);
    item.edit(title("v2"), body("b2"), INTERNAL, [new TagId("tag-1")], "author-1");
    item.submitForReview();
    item.approve("reviewer-1", true);

    assert.equal(item.publishedVersionNumber, 2);
  });

  it("deprecate keeps serving but flags stale; archive removes from service", () => {
    const item = draftItem();
    item.submitForReview();
    item.approve("reviewer-1", true);

    item.deprecate();
    assert.equal(item.status, "deprecated");
    assert.equal(item.isServed(), true);
    assert.equal(item.isStale(), true);

    item.archive();
    assert.equal(item.status, "archived");
    assert.equal(item.isServed(), false);
  });

  it("rejects in-review back to draft with a reason", () => {
    const item = draftItem();
    item.submitForReview();
    item.reject("Needs sources");
    assert.equal(item.status, "draft");
    assert.equal(lastEvent(item), "KnowledgeItemRejected");
    item.submitForReview();
    assert.throws(() => item.reject("   "), /reason is required/);
  });

  it("surfaces the last rejection reason to the author and clears it on re-submit", () => {
    const item = draftItem();
    assert.equal(item.lastRejectionReason, null);
    item.submitForReview();
    item.reject("  Needs an owner and a last-reviewed date  ");
    assert.equal(item.lastRejectionReason, "Needs an owner and a last-reviewed date");
    item.submitForReview();
    assert.equal(item.lastRejectionReason, null);
  });

  it("retags as a new working version and moves collection without a new version", () => {
    const item = draftItem();
    item.submitForReview();
    item.approve("reviewer-1", true); // v1 published

    item.retag([new TagId("tag-2")], "author-1");
    assert.equal(item.currentVersionNumber, 2);
    assert.equal(item.status, "draft");

    const versionBeforeMove = item.currentVersionNumber;
    item.moveToCollection(new CollectionId("col-2"));
    assert.equal(item.collectionId.value, "col-2");
    assert.equal(item.currentVersionNumber, versionBeforeMove); // move is not versioned
  });

  it("rolls back to a snapshot as a new draft version", () => {
    const item = draftItem();
    item.submitForReview();
    item.approve("reviewer-1", true);
    item.edit(title("bad edit"), body("oops"), INTERNAL, [new TagId("tag-1")], "author-1");

    item.rollbackTo(1, title("Refund policy"), body("Body content"), [new TagId("tag-1")], INTERNAL, "author-1");

    assert.equal(item.status, "draft");
    assert.equal(item.currentVersionNumber, 3);
    assert.equal(item.title.value, "Refund policy");
    assert.equal(lastEvent(item), "KnowledgeItemRolledBack");
  });

  it("applies a combined content + tag change as a single version, one event (B1)", () => {
    const item = draftItem();
    const changed = item.edit(
      title("New title"),
      body("New body"),
      INTERNAL,
      [new TagId("tag-2"), new TagId("tag-3")],
      "author-1",
    );

    assert.equal(changed, true);
    assert.equal(item.currentVersionNumber, 2);
    assert.deepEqual([...item.tagIds].map((tag) => tag.value).sort(), ["tag-2", "tag-3"]);
    const editEvents = item.getDomainEvents().filter((event) => event.eventName === "KnowledgeItemEdited");
    assert.equal(editEvents.length, 1);
    assert.equal(item.getDomainEvents().some((event) => event.eventName === "KnowledgeItemRetagged"), false);
  });

  it("treats an edit that changes nothing as a no-op: no version, no event (P2)", () => {
    const item = draftItem();
    const versionBefore = item.currentVersionNumber;
    const eventsBefore = item.getDomainEvents().length;

    const changed = item.edit(title(), body(), INTERNAL, [new TagId("tag-1")], "author-1");

    assert.equal(changed, false);
    assert.equal(item.currentVersionNumber, versionBefore);
    assert.equal(item.getDomainEvents().length, eventsBefore);
  });

  it("stamps the drafting event with a causation id when created from a document (S2)", () => {
    const item = KnowledgeItem.create(
      new KnowledgeItemId("item-2"),
      "company-1",
      new CollectionId("col-1"),
      title(),
      body(),
      [],
      INTERNAL,
      "author-1",
      "job-123",
    );

    const drafted = item.getDomainEvents()[0]!;
    assert.equal(drafted.eventName, "KnowledgeItemDrafted");
    assert.equal(drafted.causationId, "job-123");
  });

  describe("invalid transitions throw", () => {
    it("cannot submit a published item", () => {
      const item = draftItem();
      item.submitForReview();
      item.approve("r", true);
      assert.throws(() => item.submitForReview(), /Cannot submit/);
    });
    it("cannot approve a draft", () => {
      assert.throws(() => draftItem().approve("r", true), /Cannot approve/);
    });
    it("cannot deprecate a draft", () => {
      assert.throws(() => draftItem().deprecate(), /Cannot deprecate/);
    });
    it("cannot archive a draft", () => {
      assert.throws(() => draftItem().archive(), /Cannot archive/);
    });
    it("cannot edit or move an archived item", () => {
      const item = draftItem();
      item.submitForReview();
      item.approve("r", true);
      item.archive();
      assert.throws(() => item.edit(title("x"), body("y"), INTERNAL, [new TagId("tag-1")], "a"), /Cannot edit/);
      assert.throws(() => item.moveToCollection(new CollectionId("c")), /archived/);
    });
  });
});
