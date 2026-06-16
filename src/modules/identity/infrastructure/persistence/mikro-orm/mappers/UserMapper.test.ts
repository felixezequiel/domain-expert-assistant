import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UserMapper } from "./UserMapper.ts";
import { User } from "../../../../domain/aggregates/User.ts";
import { UserId } from "../../../../domain/identifiers/UserId.ts";
import { Email } from "../../../../domain/valueObjects/Email.ts";
import { DisplayName } from "../../../../domain/valueObjects/DisplayName.ts";
import { PasswordHash } from "../../../../domain/valueObjects/PasswordHash.ts";

describe("UserMapper", () => {
  it("round-trips an active user with multiple roles", () => {
    const original = User.reconstitute(
      new UserId("u1"),
      "company-1",
      new Email("ada@acme.com"),
      new DisplayName("Ada"),
      new PasswordHash("$argon2id$hash"),
      ["admin", "curator"],
      "active",
      null,
    );

    const entity = UserMapper.toOrmEntity(original);
    assert.equal(entity.roles, "admin,curator");

    const domain = UserMapper.toDomain(entity);
    assert.equal(domain.id.value, "u1");
    assert.equal(domain.companyId, "company-1");
    assert.equal(domain.email.value, "ada@acme.com");
    assert.equal(domain.passwordHash?.value, "$argon2id$hash");
    assert.deepEqual([...domain.roles], ["admin", "curator"]);
    assert.equal(domain.status, "active");
  });

  it("round-trips an invited user with no password and an invitation token hash", () => {
    const original = User.invite(
      new UserId("u2"),
      "company-1",
      new Email("new@acme.com"),
      new DisplayName("New"),
      ["reviewer"],
      "token-hash",
    );

    const domain = UserMapper.toDomain(UserMapper.toOrmEntity(original));

    assert.equal(domain.status, "invited");
    assert.equal(domain.passwordHash, null);
    assert.equal(domain.invitationTokenHash, "token-hash");
  });
});
