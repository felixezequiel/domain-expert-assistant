import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DisplayName } from "./DisplayName.ts";

describe("DisplayName", () => {
  it("trims and keeps the value", () => {
    assert.equal(new DisplayName("  Ada Lovelace  ").value, "Ada Lovelace");
  });

  it("rejects empty and over-long names", () => {
    assert.throws(() => new DisplayName("  "), /Display name/);
    assert.throws(() => new DisplayName("x".repeat(121)), /Display name/);
  });
});
