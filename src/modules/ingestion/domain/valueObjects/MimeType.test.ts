import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MimeType } from "./MimeType.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

describe("MimeType", () => {
  it("accepts supported mime types and normalises case/space", () => {
    assert.equal(new MimeType("  TEXT/Markdown ").value, "text/markdown");
    assert.equal(new MimeType("text/plain").isPlainText(), true);
    assert.equal(new MimeType("application/pdf").isPlainText(), false);
  });

  it("rejects an unsupported mime type with a coded DomainError", () => {
    assert.throws(() => new MimeType("image/png"), /Unsupported/);
    try {
      new MimeType("image/png");
      assert.fail("expected DomainError");
    } catch (error) {
      assert.ok(error instanceof DomainError);
      assert.equal(error.code, "ingestion.unsupportedMimeType");
      assert.equal(error.kind, "validation");
      assert.deepEqual(error.params, { mimeType: "image/png" });
      assert.equal(error.message, "Unsupported document mime type: image/png");
    }
  });
});
