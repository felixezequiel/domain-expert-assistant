import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EditKnowledgeItemCommand } from "./EditKnowledgeItemCommand.ts";

describe("EditKnowledgeItemCommand", () => {
  it("builds value objects from primitives", () => {
    const command = EditKnowledgeItemCommand.of("i1", "New title", "New body", "confidential");
    assert.equal(command.itemId.value, "i1");
    assert.equal(command.title.value, "New title");
    assert.equal(command.body.value, "New body");
    assert.equal(command.sensitivity.name, "confidential");
  });
});
