import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OrganizationId } from "./OrganizationId.ts";

describe("OrganizationId", () => {
  it("wraps a provided value and compares equal by value", () => {
    assert.equal(new OrganizationId("org-1").value, "org-1");
    assert.ok(new OrganizationId("org-1").equals(new OrganizationId("org-1")));
    assert.ok(!new OrganizationId("org-1").equals(new OrganizationId("org-2")));
  });

  it("generates a value when none is given", () => {
    assert.ok(new OrganizationId().value.length > 0);
  });
});
