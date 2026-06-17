import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CreateTenantTagCommand, RemoveTenantTagCommand } from "./TagCommands.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

describe("Tag commands", () => {
  it("CreateTenantTagCommand requires a label", () => {
    assert.equal(CreateTenantTagCommand.of("t1", "Refunds").label, "Refunds");
    assert.throws(() => CreateTenantTagCommand.of("t1", "  "), /label is required/);
  });

  it("RemoveTenantTagCommand wraps the id", () => {
    assert.equal(RemoveTenantTagCommand.of("t1").tagId.value, "t1");
  });

  it("throws a coded DomainError for a missing label", () => {
    assert.throws(
      () => CreateTenantTagCommand.of("t1", "  "),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, "knowledge.tagLabelRequired");
        assert.equal(error.kind, "validation");
        assert.equal(error.message, "Tag label is required");
        return true;
      },
    );
  });
});
