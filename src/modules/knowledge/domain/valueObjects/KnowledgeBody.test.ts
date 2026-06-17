import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { KnowledgeBody } from "./KnowledgeBody.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

describe("KnowledgeBody", () => {
  it("keeps free-form markdown/text content", () => {
    const body = new KnowledgeBody("# Heading\n\nSome body.");
    assert.equal(body.value, "# Heading\n\nSome body.");
  });

  it("rejects an empty body", () => {
    assert.throws(() => new KnowledgeBody("   "), /Body/);
  });

  it("throws a coded DomainError on an empty body", () => {
    assert.throws(
      () => new KnowledgeBody("   "),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, "knowledge.bodyEmpty");
        assert.equal(error.kind, "validation");
        assert.equal(error.params, undefined);
        assert.equal(error.message, "Body cannot be empty");
        return true;
      },
    );
  });
});
