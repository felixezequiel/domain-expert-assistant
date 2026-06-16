import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OrganizationProvisionedEvent } from "./OrganizationProvisionedEvent.ts";

describe("OrganizationProvisionedEvent", () => {
  it("carries the organization id and name", () => {
    const event = new OrganizationProvisionedEvent("org-1", "Acme");

    assert.equal(event.eventName, "OrganizationProvisioned");
    assert.equal(event.aggregateId, "org-1");
    assert.equal(event.name, "Acme");
  });
});
