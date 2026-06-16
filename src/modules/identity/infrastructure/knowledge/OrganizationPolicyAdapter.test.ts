import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OrganizationPolicyAdapter } from "./OrganizationPolicyAdapter.ts";
import type { OrganizationRepositoryPort } from "../../application/types.ts";
import type { Organization } from "../../domain/aggregates/Organization.ts";
import type { OrganizationId } from "../../domain/identifiers/OrganizationId.ts";

class FakeOrganizationRepository implements OrganizationRepositoryPort {
  private readonly byId: Map<string, Organization>;

  constructor(byId: Map<string, Organization> = new Map()) {
    this.byId = byId;
  }

  public async save(): Promise<void> {}

  public async findById(id: OrganizationId): Promise<Organization | null> {
    return this.byId.get(id.value) ?? null;
  }

  public async existsByName(): Promise<boolean> {
    return false;
  }
}

function organizationWithPolicy(requireSeparateReviewer: boolean): Organization {
  return { policy: { requireSeparateReviewer } } as unknown as Organization;
}

describe("OrganizationPolicyAdapter", () => {
  it("returns the org's requireSeparateReviewer policy when it is enabled", async () => {
    const repository = new FakeOrganizationRepository(
      new Map([["company-1", organizationWithPolicy(true)]]),
    );
    const adapter = new OrganizationPolicyAdapter(repository);

    assert.equal(await adapter.requireSeparateReviewer("company-1"), true);
  });

  it("returns the org's requireSeparateReviewer policy when it is disabled", async () => {
    const repository = new FakeOrganizationRepository(
      new Map([["company-1", organizationWithPolicy(false)]]),
    );
    const adapter = new OrganizationPolicyAdapter(repository);

    assert.equal(await adapter.requireSeparateReviewer("company-1"), false);
  });

  it("returns false when the organization does not exist", async () => {
    const adapter = new OrganizationPolicyAdapter(new FakeOrganizationRepository());

    assert.equal(await adapter.requireSeparateReviewer("missing-company"), false);
  });
});
