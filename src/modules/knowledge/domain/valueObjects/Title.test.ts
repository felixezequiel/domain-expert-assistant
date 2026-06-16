import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Title } from "./Title.ts";

describe("Title", () => {
  it("trims and keeps the value", () => {
    assert.equal(new Title("  Refund policy  ").value, "Refund policy");
  });

  it("rejects empty and over-long titles", () => {
    assert.throws(() => new Title("   "), /Title/);
    assert.throws(() => new Title("x".repeat(201)), /Title/);
  });
});
