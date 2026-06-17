import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OrganizationMapper } from "./OrganizationMapper.ts";
import { Organization } from "../../../../domain/aggregates/Organization.ts";
import { OrganizationId } from "../../../../domain/identifiers/OrganizationId.ts";
import { OrganizationName } from "../../../../domain/valueObjects/OrganizationName.ts";
import { OrganizationPolicy } from "../../../../domain/valueObjects/OrganizationPolicy.ts";

describe("OrganizationMapper", () => {
  it("round-trips an organization through the ORM entity", () => {
    const original = Organization.reconstitute(
      new OrganizationId("org-1"),
      new OrganizationName("Acme"),
      "active",
      OrganizationPolicy.of(false),
      new Date("2026-01-02T03:04:05.000Z"),
    );

    const domain = OrganizationMapper.toDomain(OrganizationMapper.toOrmEntity(original));

    assert.equal(domain.id.value, "org-1");
    assert.equal(domain.name.value, "Acme");
    assert.equal(domain.status, "active");
    assert.equal(domain.policy.requireSeparateReviewer, false);
    assert.equal(domain.createdAt.toISOString(), "2026-01-02T03:04:05.000Z");
  });
});
