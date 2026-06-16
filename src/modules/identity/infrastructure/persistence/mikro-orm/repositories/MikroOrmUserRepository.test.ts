import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MikroOrmUserRepository } from "./MikroOrmUserRepository.ts";
import { createFakeEntityManagerProvider } from "./testing/index.ts";
import { User } from "../../../../domain/aggregates/User.ts";
import { UserId } from "../../../../domain/identifiers/UserId.ts";
import { Email } from "../../../../domain/valueObjects/Email.ts";
import { DisplayName } from "../../../../domain/valueObjects/DisplayName.ts";
import { PasswordHash } from "../../../../domain/valueObjects/PasswordHash.ts";
import type { Role } from "../../../../../../shared/domain/Role.ts";

function activeUser(id: string, email: string, roles: ReadonlyArray<Role>): User {
  return User.reconstitute(
    new UserId(id),
    "company-1",
    new Email(email),
    new DisplayName("X"),
    new PasswordHash("h"),
    roles,
    "active",
  );
}

describe("MikroOrmUserRepository", () => {
  it("saves and finds by id and email", async () => {
    const repo = new MikroOrmUserRepository(createFakeEntityManagerProvider());
    await repo.save(activeUser("u1", "ada@acme.com", ["admin"]));

    assert.equal((await repo.findById(new UserId("u1")))?.email.value, "ada@acme.com");
    assert.equal((await repo.findByEmail("ADA@ACME.COM"))?.id.value, "u1");
    assert.equal(await repo.existsByEmail("ada@acme.com"), true);
    assert.equal(await repo.existsByEmail("nobody@acme.com"), false);
  });

  it("finds an invited user by invitation token hash", async () => {
    const repo = new MikroOrmUserRepository(createFakeEntityManagerProvider());
    await repo.save(
      User.invite(new UserId("u2"), "company-1", new Email("new@acme.com"), new DisplayName("New"), ["curator"], "tok-hash"),
    );

    assert.equal((await repo.findByInvitationTokenHash("tok-hash"))?.id.value, "u2");
    assert.equal(await repo.findByInvitationTokenHash("missing"), null);
  });

  it("counts only active admins of the company", async () => {
    const repo = new MikroOrmUserRepository(createFakeEntityManagerProvider());
    await repo.save(activeUser("u1", "a@acme.com", ["admin"]));
    await repo.save(activeUser("u2", "b@acme.com", ["admin", "curator"]));
    await repo.save(activeUser("u3", "c@acme.com", ["curator"]));

    assert.equal(await repo.countActiveAdmins("company-1"), 2);
    assert.equal(await repo.countActiveAdmins("company-OTHER"), 0);
  });
});
