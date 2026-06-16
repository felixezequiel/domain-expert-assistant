import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { snapshotOf } from "./knowledgeVersionSnapshot.ts";
import { KnowledgeItem } from "../domain/aggregates/KnowledgeItem.ts";
import { KnowledgeItemId } from "../domain/identifiers/KnowledgeItemId.ts";
import { CollectionId } from "../domain/identifiers/CollectionId.ts";
import { TagId } from "../domain/identifiers/TagId.ts";
import { Title } from "../domain/valueObjects/Title.ts";
import { KnowledgeBody } from "../domain/valueObjects/KnowledgeBody.ts";
import { SensitivityLevel } from "../../../shared/domain/valueObjects/SensitivityLevel.ts";

describe("snapshotOf", () => {
  it("captures the item's current content as a version snapshot", () => {
    const item = KnowledgeItem.create(
      new KnowledgeItemId("i1"),
      "company-1",
      new CollectionId("c1"),
      new Title("Title"),
      new KnowledgeBody("Body"),
      [new TagId("t1"), new TagId("t2")],
      SensitivityLevel.of("internal"),
      "author-1",
    );

    const snapshot = snapshotOf(item, "author-1", new Date("2026-06-16T00:00:00.000Z"));

    assert.equal(snapshot.itemId, "i1");
    assert.equal(snapshot.versionNumber, 1);
    assert.equal(snapshot.title, "Title");
    assert.deepEqual([...snapshot.tagIds], ["t1", "t2"]);
    assert.equal(snapshot.sensitivity, "internal");
    assert.equal(snapshot.createdBy, "author-1");
  });
});
