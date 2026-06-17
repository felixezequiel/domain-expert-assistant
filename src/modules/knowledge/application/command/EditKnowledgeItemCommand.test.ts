import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EditKnowledgeItemCommand } from "./EditKnowledgeItemCommand.ts";

describe("EditKnowledgeItemCommand", () => {
  it("builds value objects from primitives, including the tag set", () => {
    const command = EditKnowledgeItemCommand.of("i1", "New title", "New body", "confidential", ["t1", "t2"]);
    assert.equal(command.itemId.value, "i1");
    assert.equal(command.title.value, "New title");
    assert.equal(command.body.value, "New body");
    assert.equal(command.sensitivity.name, "confidential");
    assert.deepEqual(command.tagIds.map((tag) => tag.value), ["t1", "t2"]);
  });
});
