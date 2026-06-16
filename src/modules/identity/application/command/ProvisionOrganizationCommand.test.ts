import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ProvisionOrganizationCommand } from "./ProvisionOrganizationCommand.ts";

describe("ProvisionOrganizationCommand", () => {
  it("builds value objects from primitives", () => {
    const command = ProvisionOrganizationCommand.of(
      "org-1",
      "Acme",
      "user-1",
      "Admin@Acme.com",
      "Admin",
      "s3cret",
    );

    assert.equal(command.organizationId.value, "org-1");
    assert.equal(command.organizationName.value, "Acme");
    assert.equal(command.adminUserId.value, "user-1");
    assert.equal(command.adminEmail.value, "admin@acme.com");
    assert.equal(command.adminDisplayName.value, "Admin");
    assert.equal(command.adminPassword, "s3cret");
  });

  it("rejects an invalid admin email at construction", () => {
    assert.throws(
      () => ProvisionOrganizationCommand.of("org-1", "Acme", "user-1", "bad", "Admin", "s3cret"),
      /Invalid email/,
    );
  });
});
