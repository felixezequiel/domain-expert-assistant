import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OrganizationPolicyChangedEvent } from "./OrganizationPolicyChangedEvent.ts";

describe("OrganizationPolicyChangedEvent", () => {
  it("carries the organization id and the new policy flag", () => {
    const event = new OrganizationPolicyChangedEvent("org-1", false);

    assert.equal(event.eventName, "OrganizationPolicyChanged");
    assert.equal(event.aggregateId, "org-1");
    assert.equal(event.requireSeparateReviewer, false);
  });
});
