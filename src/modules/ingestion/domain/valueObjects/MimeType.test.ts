import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MimeType } from "./MimeType.ts";

describe("MimeType", () => {
  it("accepts supported mime types and normalises case/space", () => {
    assert.equal(new MimeType("  TEXT/Markdown ").value, "text/markdown");
    assert.equal(new MimeType("text/plain").isPlainText(), true);
    assert.equal(new MimeType("application/pdf").isPlainText(), false);
  });

  it("rejects an unsupported mime type", () => {
    assert.throws(() => new MimeType("image/png"), /Unsupported/);
  });
});
