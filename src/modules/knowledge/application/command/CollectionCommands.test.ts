import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CreateCollectionCommand, RenameCollectionCommand } from "./CollectionCommands.ts";

describe("Collection commands", () => {
  it("CreateCollectionCommand wraps id, name, description", () => {
    const command = CreateCollectionCommand.of("c1", "Policies", "desc");
    assert.equal(command.collectionId.value, "c1");
    assert.equal(command.name, "Policies");
    assert.equal(command.description, "desc");
  });

  it("RenameCollectionCommand wraps id + name", () => {
    const command = RenameCollectionCommand.of("c1", "New");
    assert.equal(command.collectionId.value, "c1");
    assert.equal(command.name, "New");
  });
});
