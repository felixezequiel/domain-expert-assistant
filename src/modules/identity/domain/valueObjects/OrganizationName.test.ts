import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OrganizationName } from "./OrganizationName.ts";

describe("OrganizationName", () => {
  it("trims surrounding whitespace", () => {
    assert.equal(new OrganizationName("  Acme  ").value, "Acme");
  });

  it("rejects an empty or whitespace-only name", () => {
    assert.throws(() => new OrganizationName(""), /Organization name/);
    assert.throws(() => new OrganizationName("   "), /Organization name/);
  });

  it("rejects a name beyond the maximum length", () => {
    assert.throws(() => new OrganizationName("a".repeat(201)), /Organization name/);
  });

  it("compares equal by value", () => {
    assert.ok(new OrganizationName("Acme").equals(new OrganizationName("Acme")));
  });
});
