import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { KnowledgeBody } from "./KnowledgeBody.ts";

describe("KnowledgeBody", () => {
  it("keeps free-form markdown/text content", () => {
    const body = new KnowledgeBody("# Heading\n\nSome body.");
    assert.equal(body.value, "# Heading\n\nSome body.");
  });

  it("rejects an empty body", () => {
    assert.throws(() => new KnowledgeBody("   "), /Body/);
  });
});
