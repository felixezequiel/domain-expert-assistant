import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SubmitForReviewCommand,
  ApproveItemCommand,
  DeprecateItemCommand,
  ArchiveItemCommand,
  RejectItemCommand,
} from "./LifecycleCommands.ts";

describe("Lifecycle commands", () => {
  it("wrap the item id", () => {
    assert.equal(SubmitForReviewCommand.of("i1").itemId.value, "i1");
    assert.equal(ApproveItemCommand.of("i1").itemId.value, "i1");
    assert.equal(DeprecateItemCommand.of("i1").itemId.value, "i1");
    assert.equal(ArchiveItemCommand.of("i1").itemId.value, "i1");
  });

  it("RejectItemCommand carries a required reason", () => {
    assert.equal(RejectItemCommand.of("i1", "  needs sources ").reason, "needs sources");
    assert.throws(() => RejectItemCommand.of("i1", "  "), /reason is required/);
  });
});
