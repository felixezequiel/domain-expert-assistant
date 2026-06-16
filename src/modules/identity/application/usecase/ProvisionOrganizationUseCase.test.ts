import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ProvisionOrganizationUseCase } from "./ProvisionOrganizationUseCase.ts";
import { ProvisionOrganizationCommand } from "../command/ProvisionOrganizationCommand.ts";
import { FakeOrganizationRepository, FakeUserRepository, FakePasswordHasher } from "../testDoubles/index.ts";
import { Organization } from "../../domain/aggregates/Organization.ts";
import { User } from "../../domain/aggregates/User.ts";
import { OrganizationId } from "../../domain/identifiers/OrganizationId.ts";
import { OrganizationName } from "../../domain/valueObjects/OrganizationName.ts";
import { UserId } from "../../domain/identifiers/UserId.ts";
import { Email } from "../../domain/valueObjects/Email.ts";
import { DisplayName } from "../../domain/valueObjects/DisplayName.ts";
import { AggregateRoot } from "../../../../shared/domain/aggregates/AggregateRoot.ts";

const COMMAND = ProvisionOrganizationCommand.of(
  "org-1",
  "Acme",
  "user-1",
  "admin@acme.com",
  "Admin",
  "s3cret",
);

describe("ProvisionOrganizationUseCase", () => {
  const tracked: Array<unknown> = [];

  beforeEach(() => {
    tracked.length = 0;
    AggregateRoot.setOnTrack((aggregate) => tracked.push(aggregate));
  });

  afterEach(() => {
    AggregateRoot.setOnTrack(null);
  });

  function build(): ProvisionOrganizationUseCase {
    return new ProvisionOrganizationUseCase(
      new FakeOrganizationRepository(),
      new FakeUserRepository(),
      new FakePasswordHasher(),
    );
  }

  it("provisions the organization and emits OrganizationProvisioned", async () => {
    const organization = await build().execute(COMMAND);

    assert.ok(organization instanceof Organization);
    assert.equal(organization.name.value, "Acme");
    assert.equal(organization.getDomainEvents()[0]!.eventName, "OrganizationProvisioned");
  });

  it("creates the first admin as an active admin with a hashed password", async () => {
    await build().execute(COMMAND);

    const admin = tracked.find((aggregate) => aggregate instanceof User) as User | undefined;
    assert.ok(admin !== undefined);
    assert.equal(admin.status, "active");
    assert.equal(admin.isAdmin(), true);
    assert.equal(admin.companyId, "org-1");
    assert.equal(admin.passwordHash?.value, "h:s3cret");
  });

  it("rejects a duplicate organization name", async () => {
    const organizationRepository = new FakeOrganizationRepository();
    await organizationRepository.save(
      Organization.provision(new OrganizationId("other"), new OrganizationName("Acme")),
    );
    const useCase = new ProvisionOrganizationUseCase(
      organizationRepository,
      new FakeUserRepository(),
      new FakePasswordHasher(),
    );

    await assert.rejects(() => useCase.execute(COMMAND), /already taken/);
  });

  it("rejects a duplicate admin email", async () => {
    const userRepository = new FakeUserRepository();
    await userRepository.save(
      User.invite(new UserId("u9"), "c9", new Email("admin@acme.com"), new DisplayName("X"), ["curator"]),
    );
    const useCase = new ProvisionOrganizationUseCase(
      new FakeOrganizationRepository(),
      userRepository,
      new FakePasswordHasher(),
    );

    await assert.rejects(() => useCase.execute(COMMAND), /already in use/);
  });
});
