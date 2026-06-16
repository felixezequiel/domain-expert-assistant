import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ChangeUserRolesUseCase } from "./ChangeUserRolesUseCase.ts";
import { ChangeUserRolesCommand } from "../command/ChangeUserRolesCommand.ts";
import { LastAdminError } from "../errors.ts";
import { FakeUserRepository } from "../testDoubles/index.ts";
import { User } from "../../domain/aggregates/User.ts";
import { UserId } from "../../domain/identifiers/UserId.ts";
import { Email } from "../../domain/valueObjects/Email.ts";
import { DisplayName } from "../../domain/valueObjects/DisplayName.ts";
import { PasswordHash } from "../../domain/valueObjects/PasswordHash.ts";
import type { Role } from "../../../../shared/domain/Role.ts";

function admin(id: string, email: string, roles: ReadonlyArray<Role> = ["admin"]): User {
  return User.reconstitute(
    new UserId(id),
    "company-1",
    new Email(email),
    new DisplayName("X"),
    new PasswordHash("h:x"),
    roles,
    "active",
  );
}

describe("ChangeUserRolesUseCase", () => {
  it("declares the admin role requirement", () => {
    assert.deepEqual([...new ChangeUserRolesUseCase(new FakeUserRepository()).requiredRoles], ["admin"]);
  });

  it("changes a user's roles", async () => {
    const repo = new FakeUserRepository();
    await repo.save(admin("u1", "a@acme.com", ["curator"]));
    const useCase = new ChangeUserRolesUseCase(repo);

    const user = await useCase.execute(ChangeUserRolesCommand.of("u1", ["reviewer", "auditor"]));

    assert.deepEqual([...user.roles].sort(), ["auditor", "reviewer"]);
  });

  it("refuses to strip admin from the last active admin", async () => {
    const repo = new FakeUserRepository();
    await repo.save(admin("u1", "a@acme.com", ["admin"]));
    const useCase = new ChangeUserRolesUseCase(repo);

    await assert.rejects(() => useCase.execute(ChangeUserRolesCommand.of("u1", ["curator"])), LastAdminError);
  });

  it("allows stripping admin when another active admin remains", async () => {
    const repo = new FakeUserRepository();
    await repo.save(admin("u1", "a@acme.com", ["admin"]));
    await repo.save(admin("u2", "b@acme.com", ["admin"]));
    const useCase = new ChangeUserRolesUseCase(repo);

    const user = await useCase.execute(ChangeUserRolesCommand.of("u1", ["curator"]));

    assert.deepEqual([...user.roles], ["curator"]);
  });

  it("throws when the user does not exist", async () => {
    const useCase = new ChangeUserRolesUseCase(new FakeUserRepository());

    await assert.rejects(() => useCase.execute(ChangeUserRolesCommand.of("ghost", ["curator"])), /not found/);
  });
});
