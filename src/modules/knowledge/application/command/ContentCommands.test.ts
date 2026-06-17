import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RollbackToVersionCommand, RetagItemCommand, MoveItemToCollectionCommand } from "./ContentCommands.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

describe("Content commands", () => {
  it("RollbackToVersionCommand validates a positive version", () => {
    assert.equal(RollbackToVersionCommand.of("i1", 3).versionNumber, 3);
    assert.throws(() => RollbackToVersionCommand.of("i1", 0), /positive integer/);
    assert.throws(() => RollbackToVersionCommand.of("i1", 1.5), /positive integer/);
  });

  it("throws a coded DomainError for an invalid version number", () => {
    assert.throws(
      () => RollbackToVersionCommand.of("i1", 0),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, "knowledge.versionNumberInvalid");
        assert.equal(error.kind, "validation");
        assert.equal(error.message, "Version number must be a positive integer");
        return true;
      },
    );
  });

  it("RetagItemCommand maps tag ids", () => {
    const command = RetagItemCommand.of("i1", ["t1", "t2"]);
    assert.deepEqual(command.tagIds.map((t) => t.value), ["t1", "t2"]);
  });

  it("MoveItemToCollectionCommand wraps ids", () => {
    const command = MoveItemToCollectionCommand.of("i1", "c2");
    assert.equal(command.itemId.value, "i1");
    assert.equal(command.collectionId.value, "c2");
  });
});
