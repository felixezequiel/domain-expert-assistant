import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { KnowledgeItemId } from "./KnowledgeItemId.ts";

describe("KnowledgeItemId", () => {
  it("wraps a value and compares equal by value", () => {
    assert.equal(new KnowledgeItemId("item-1").value, "item-1");
    assert.ok(new KnowledgeItemId("item-1").equals(new KnowledgeItemId("item-1")));
  });
});
