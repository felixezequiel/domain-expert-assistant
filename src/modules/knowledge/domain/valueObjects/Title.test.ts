import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Title } from "./Title.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

describe("Title", () => {
  it("trims and keeps the value", () => {
    assert.equal(new Title("  Refund policy  ").value, "Refund policy");
  });

  it("rejects empty and over-long titles", () => {
    assert.throws(() => new Title("   "), /Title/);
    assert.throws(() => new Title("x".repeat(201)), /Title/);
  });

  it("throws a coded DomainError on a length violation", () => {
    assert.throws(
      () => new Title("   "),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, "knowledge.titleLength");
        assert.equal(error.kind, "validation");
        assert.deepEqual(error.params, { max: 200 });
        assert.equal(error.message, "Title must be 1..200 characters");
        return true;
      },
    );
  });
});
