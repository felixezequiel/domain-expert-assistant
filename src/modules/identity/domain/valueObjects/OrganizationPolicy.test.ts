import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OrganizationPolicy } from "./OrganizationPolicy.ts";

describe("OrganizationPolicy", () => {
  it("defaults to requiring a separate reviewer", () => {
    assert.equal(OrganizationPolicy.default().requireSeparateReviewer, true);
  });

  it("builds from an explicit flag", () => {
    assert.equal(OrganizationPolicy.of(false).requireSeparateReviewer, false);
  });

  it("returns a new policy when toggling, leaving the original unchanged", () => {
    const original = OrganizationPolicy.default();
    const toggled = original.withRequireSeparateReviewer(false);

    assert.equal(original.requireSeparateReviewer, true);
    assert.equal(toggled.requireSeparateReviewer, false);
  });

  it("compares equal by value", () => {
    assert.ok(OrganizationPolicy.of(true).equals(OrganizationPolicy.default()));
  });
});
