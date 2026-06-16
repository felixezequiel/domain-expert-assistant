import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SetOrganizationPolicyUseCase } from "./SetOrganizationPolicyUseCase.ts";
import { SetOrganizationPolicyCommand } from "../command/SetOrganizationPolicyCommand.ts";
import { FakeOrganizationRepository } from "../testDoubles/index.ts";
import { Organization } from "../../domain/aggregates/Organization.ts";
import { OrganizationId } from "../../domain/identifiers/OrganizationId.ts";
import { OrganizationName } from "../../domain/valueObjects/OrganizationName.ts";
import { runWithActor } from "../../../../shared/application/context/ActorContext.ts";

const ADMIN_SCOPE = { companyId: "org-1", actorId: "admin", actorType: "user" as const, roles: ["admin" as const] };

describe("SetOrganizationPolicyUseCase", () => {
  it("changes the policy of the actor's own org and emits the event", async () => {
    const repo = new FakeOrganizationRepository();
    await repo.save(Organization.provision(new OrganizationId("org-1"), new OrganizationName("Acme")));
    const useCase = new SetOrganizationPolicyUseCase(repo);

    const organization = await runWithActor(ADMIN_SCOPE, () =>
      useCase.execute(SetOrganizationPolicyCommand.of(false)),
    );

    assert.equal(organization.policy.requireSeparateReviewer, false);
    assert.equal(
      organization.getDomainEvents().some((event) => event.eventName === "OrganizationPolicyChanged"),
      true,
    );
  });

  it("throws when the org is missing", async () => {
    const useCase = new SetOrganizationPolicyUseCase(new FakeOrganizationRepository());

    await assert.rejects(
      () => runWithActor(ADMIN_SCOPE, () => useCase.execute(SetOrganizationPolicyCommand.of(true))),
      /not found/,
    );
  });

  it("fails when there is no tenant in the actor context", async () => {
    const repo = new FakeOrganizationRepository();
    await repo.save(Organization.provision(new OrganizationId("org-1"), new OrganizationName("Acme")));
    const useCase = new SetOrganizationPolicyUseCase(repo);

    await assert.rejects(() => useCase.execute(SetOrganizationPolicyCommand.of(true)), /without a tenant/);
  });
});
