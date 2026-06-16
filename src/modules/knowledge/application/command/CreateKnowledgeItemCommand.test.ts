import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CreateKnowledgeItemCommand } from "./CreateKnowledgeItemCommand.ts";

describe("CreateKnowledgeItemCommand", () => {
  it("builds value objects from primitives", () => {
    const command = CreateKnowledgeItemCommand.of("i1", "c1", "Title", "Body", ["t1", "t2"], "internal");
    assert.equal(command.itemId.value, "i1");
    assert.equal(command.collectionId.value, "c1");
    assert.equal(command.title.value, "Title");
    assert.equal(command.body.value, "Body");
    assert.deepEqual(command.tagIds.map((t) => t.value), ["t1", "t2"]);
    assert.equal(command.sensitivity.name, "internal");
  });

  it("rejects an unknown sensitivity", () => {
    assert.throws(() => CreateKnowledgeItemCommand.of("i", "c", "T", "B", [], "secret"), /sensitivity/);
  });
});
