import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CreateTenantTagCommand, RemoveTenantTagCommand } from "./TagCommands.ts";

describe("Tag commands", () => {
  it("CreateTenantTagCommand requires a label", () => {
    assert.equal(CreateTenantTagCommand.of("t1", "Refunds").label, "Refunds");
    assert.throws(() => CreateTenantTagCommand.of("t1", "  "), /label is required/);
  });

  it("RemoveTenantTagCommand wraps the id", () => {
    assert.equal(RemoveTenantTagCommand.of("t1").tagId.value, "t1");
  });
});
