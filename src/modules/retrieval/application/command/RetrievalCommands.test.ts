import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ProjectItemCommand,
  DeprecateItemIndexCommand,
  RemoveItemFromIndexCommand,
  RebuildIndexCommand,
  SemanticSearchCommand,
} from "./RetrievalCommands.ts";

describe("Retrieval commands", () => {
  it("ProjectItemCommand carries the item id", () => {
    assert.equal(ProjectItemCommand.of("item-1").itemId, "item-1");
  });

  it("DeprecateItemIndexCommand carries company + item", () => {
    const command = DeprecateItemIndexCommand.of("c1", "item-1");
    assert.equal(command.companyId, "c1");
    assert.equal(command.itemId, "item-1");
  });

  it("RemoveItemFromIndexCommand carries company + item", () => {
    const command = RemoveItemFromIndexCommand.of("c1", "item-1");
    assert.equal(command.companyId, "c1");
    assert.equal(command.itemId, "item-1");
  });

  it("RebuildIndexCommand carries the company id", () => {
    assert.equal(RebuildIndexCommand.of("c1").companyId, "c1");
  });

  it("SemanticSearchCommand defaults scope to null and limit to 10", () => {
    const command = SemanticSearchCommand.of("c1", "how to refund");
    assert.equal(command.companyId, "c1");
    assert.equal(command.query, "how to refund");
    assert.equal(command.collectionIds, null);
    assert.equal(command.sensitivityCeiling, null);
    assert.equal(command.limit, 10);
  });

  it("SemanticSearchCommand keeps an explicit scope and limit", () => {
    const command = SemanticSearchCommand.of("c1", "q", ["col-1"], "internal", 5);
    assert.deepEqual(command.collectionIds, ["col-1"]);
    assert.equal(command.sensitivityCeiling, "internal");
    assert.equal(command.limit, 5);
  });
});
