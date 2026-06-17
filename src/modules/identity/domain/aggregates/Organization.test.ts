import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Organization } from "./Organization.ts";
import { OrganizationId } from "../identifiers/OrganizationId.ts";
import { OrganizationName } from "../valueObjects/OrganizationName.ts";
import { OrganizationPolicy } from "../valueObjects/OrganizationPolicy.ts";

function provision(): Organization {
  return Organization.provision(new OrganizationId("org-1"), new OrganizationName("Acme"));
}

describe("Organization", () => {
  it("provisions as active with the default policy and emits OrganizationProvisioned", () => {
    const org = provision();

    assert.equal(org.id.value, "org-1");
    assert.equal(org.name.value, "Acme");
    assert.equal(org.status, "active");
    assert.equal(org.policy.requireSeparateReviewer, true);

    const events = org.getDomainEvents();
    assert.equal(events.length, 1);
    assert.equal(events[0]!.eventName, "OrganizationProvisioned");
  });

  it("exposes companyId equal to its own id so its events attribute to the tenant", () => {
    assert.equal(provision().companyId, "org-1");
  });

  it("changes the policy and emits OrganizationPolicyChanged", () => {
    const org = provision();
    org.drainDomainEvents();

    org.changePolicy(OrganizationPolicy.of(false));

    assert.equal(org.policy.requireSeparateReviewer, false);
    const events = org.getDomainEvents();
    assert.equal(events.length, 1);
    assert.equal(events[0]!.eventName, "OrganizationPolicyChanged");
  });

  it("does not emit an event when the policy is unchanged", () => {
    const org = provision();
    org.drainDomainEvents();

    org.changePolicy(OrganizationPolicy.of(true));

    assert.equal(org.getDomainEvents().length, 0);
  });

  it("reconstitutes without emitting events", () => {
    const org = Organization.reconstitute(
      new OrganizationId("org-1"),
      new OrganizationName("Acme"),
      "active",
      OrganizationPolicy.of(false),
      new Date("2026-01-01T00:00:00.000Z"),
    );

    assert.equal(org.status, "active");
    assert.equal(org.policy.requireSeparateReviewer, false);
    assert.equal(org.getDomainEvents().length, 0);
  });
});
