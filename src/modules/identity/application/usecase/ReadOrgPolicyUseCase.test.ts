import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ReadOrgPolicyUseCase } from "./ReadOrgPolicyUseCase.ts";
import { FakeOrganizationRepository } from "../testDoubles/index.ts";
import { Organization } from "../../domain/aggregates/Organization.ts";
import { OrganizationId } from "../../domain/identifiers/OrganizationId.ts";
import { OrganizationName } from "../../domain/valueObjects/OrganizationName.ts";
import { OrganizationPolicy } from "../../domain/valueObjects/OrganizationPolicy.ts";
import { runWithActor } from "../../../../shared/application/context/ActorContext.ts";

const ADMIN_SCOPE = {
  companyId: "company-1",
  actorId: "admin-1",
  actorType: "user" as const,
  roles: ["admin" as const],
};

function organization(id: string, requireSeparateReviewer: boolean): Organization {
  return Organization.reconstitute(
    new OrganizationId(id),
    new OrganizationName("Acme"),
    "active",
    OrganizationPolicy.of(requireSeparateReviewer),
    new Date("2026-06-16T00:00:00.000Z"),
  );
}

describe("ReadOrgPolicyUseCase", () => {
  it("returns the tenant's current policy flag", async () => {
    const repo = new FakeOrganizationRepository();
    await repo.save(organization("company-1", true));
    const useCase = new ReadOrgPolicyUseCase(repo);

    const view = await runWithActor(ADMIN_SCOPE, () => useCase.execute());

    assert.equal(view.organizationId, "company-1");
    assert.equal(view.requireSeparateReviewer, true);
  });

  it("fails without a tenant in the context", async () => {
    const useCase = new ReadOrgPolicyUseCase(new FakeOrganizationRepository());

    await assert.rejects(() => useCase.execute(), /without a tenant/);
  });
});
