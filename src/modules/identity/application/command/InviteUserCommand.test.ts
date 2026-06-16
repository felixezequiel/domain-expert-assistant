import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { InviteUserCommand } from "./InviteUserCommand.ts";

describe("InviteUserCommand", () => {
  it("builds VOs and parses roles", () => {
    const command = InviteUserCommand.of("u1", "New@Acme.com", "New User", ["curator", "reviewer"]);

    assert.equal(command.userId.value, "u1");
    assert.equal(command.email.value, "new@acme.com");
    assert.equal(command.displayName.value, "New User");
    assert.deepEqual([...command.roles], ["curator", "reviewer"]);
  });

  it("rejects an unknown role", () => {
    assert.throws(() => InviteUserCommand.of("u1", "a@b.com", "X", ["wizard"]), /Unknown role/);
  });
});
