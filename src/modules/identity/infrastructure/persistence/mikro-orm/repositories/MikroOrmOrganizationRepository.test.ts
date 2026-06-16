import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MikroOrmOrganizationRepository } from "./MikroOrmOrganizationRepository.ts";
import { createFakeEntityManagerProvider } from "./testing/index.ts";
import { Organization } from "../../../../domain/aggregates/Organization.ts";
import { OrganizationId } from "../../../../domain/identifiers/OrganizationId.ts";
import { OrganizationName } from "../../../../domain/valueObjects/OrganizationName.ts";

describe("MikroOrmOrganizationRepository", () => {
  it("saves then finds an organization by id", async () => {
    const repo = new MikroOrmOrganizationRepository(createFakeEntityManagerProvider());
    await repo.save(Organization.provision(new OrganizationId("org-1"), new OrganizationName("Acme")));

    const found = await repo.findById(new OrganizationId("org-1"));

    assert.equal(found?.name.value, "Acme");
    assert.equal(await repo.findById(new OrganizationId("missing")), null);
  });

  it("reports name existence", async () => {
    const repo = new MikroOrmOrganizationRepository(createFakeEntityManagerProvider());
    await repo.save(Organization.provision(new OrganizationId("org-1"), new OrganizationName("Acme")));

    assert.equal(await repo.existsByName("Acme"), true);
    assert.equal(await repo.existsByName("Globex"), false);
  });
});
