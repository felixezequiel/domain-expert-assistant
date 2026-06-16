import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { User } from "./User.ts";
import { UserId } from "../identifiers/UserId.ts";
import { Email } from "../valueObjects/Email.ts";
import { DisplayName } from "../valueObjects/DisplayName.ts";
import { PasswordHash } from "../valueObjects/PasswordHash.ts";

function invite(roles: Array<"admin" | "curator" | "reviewer" | "auditor" | "consumer"> = ["curator"]): User {
  return User.invite(
    new UserId("user-1"),
    "company-1",
    new Email("ada@acme.com"),
    new DisplayName("Ada"),
    roles,
  );
}

describe("User", () => {
  it("invites a user as 'invited' with no password and emits UserInvited", () => {
    const user = invite();

    assert.equal(user.status, "invited");
    assert.equal(user.passwordHash, null);
    assert.equal(user.companyId, "company-1");
    assert.deepEqual([...user.roles], ["curator"]);
    assert.equal(user.getDomainEvents()[0]!.eventName, "UserInvited");
  });

  it("requires at least one role to invite", () => {
    assert.throws(() => invite([]), /at least one role/);
  });

  it("dedups roles", () => {
    const user = invite(["admin", "admin", "curator"]);
    assert.deepEqual([...user.roles].sort(), ["admin", "curator"]);
  });

  it("activates an invited user, setting the password and status, emitting UserActivated", () => {
    const user = invite();
    user.drainDomainEvents();

    user.activate(new PasswordHash("$argon2id$hash"));

    assert.equal(user.status, "active");
    assert.equal(user.passwordHash?.value, "$argon2id$hash");
    assert.equal(user.getDomainEvents()[0]!.eventName, "UserActivated");
  });

  it("refuses to activate a user that is not invited", () => {
    const user = invite();
    user.activate(new PasswordHash("$argon2id$hash"));

    assert.throws(() => user.activate(new PasswordHash("$argon2id$other")), /not invited/);
  });

  it("changes roles and emits UserRolesChanged", () => {
    const user = invite();
    user.drainDomainEvents();

    user.changeRoles(["admin", "auditor"]);

    assert.deepEqual([...user.roles].sort(), ["admin", "auditor"]);
    assert.equal(user.getDomainEvents()[0]!.eventName, "UserRolesChanged");
  });

  it("refuses to leave a user with no roles", () => {
    const user = invite();
    assert.throws(() => user.changeRoles([]), /at least one role/);
  });

  it("disables a user and emits UserDisabled", () => {
    const user = invite();
    user.activate(new PasswordHash("$argon2id$hash"));
    user.drainDomainEvents();

    user.disable();

    assert.equal(user.status, "disabled");
    assert.equal(user.getDomainEvents()[0]!.eventName, "UserDisabled");
  });

  it("is idempotent when disabling an already-disabled user (no event)", () => {
    const user = invite();
    user.disable();
    user.drainDomainEvents();

    user.disable();
    assert.equal(user.getDomainEvents().length, 0);
  });

  it("reports whether it holds the admin role", () => {
    assert.equal(invite(["admin"]).isAdmin(), true);
    assert.equal(invite(["curator"]).isAdmin(), false);
  });

  it("reconstitutes without emitting events", () => {
    const user = User.reconstitute(
      new UserId("user-1"),
      "company-1",
      new Email("ada@acme.com"),
      new DisplayName("Ada"),
      new PasswordHash("$argon2id$hash"),
      ["admin"],
      "active",
    );

    assert.equal(user.status, "active");
    assert.equal(user.getDomainEvents().length, 0);
  });
});
