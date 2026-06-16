import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PlainTextExtractor } from "./PlainTextExtractor.ts";

describe("PlainTextExtractor", () => {
  const extractor = new PlainTextExtractor();

  it("supports text/plain and text/markdown only", () => {
    assert.equal(extractor.supports("text/plain"), true);
    assert.equal(extractor.supports("text/markdown"), true);
    assert.equal(extractor.supports("application/pdf"), false);
  });

  it("decodes the bytes as utf-8 text", async () => {
    assert.equal(await extractor.extract(Buffer.from("# Olá\n\nçãé")), "# Olá\n\nçãé");
  });
});
