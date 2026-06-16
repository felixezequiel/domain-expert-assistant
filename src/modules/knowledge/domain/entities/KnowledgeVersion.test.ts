import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { KnowledgeVersion } from "./KnowledgeVersion.ts";

describe("KnowledgeVersion", () => {
  it("captures the snapshot fields and copies the tag list", () => {
    const tags = ["t1", "t2"];
    const version = new KnowledgeVersion({
      itemId: "item-1",
      versionNumber: 2,
      title: "T",
      body: "B",
      tagIds: tags,
      sensitivity: "internal",
      createdBy: "user-1",
      createdAt: new Date("2026-06-16T00:00:00.000Z"),
    });

    assert.equal(version.versionNumber, 2);
    assert.deepEqual([...version.tagIds], ["t1", "t2"]);

    tags.push("t3");
    assert.equal(version.tagIds.length, 2, "snapshot must not alias the caller's array");
  });
});
