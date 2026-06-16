import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ChangeUserRolesCommand } from "./ChangeUserRolesCommand.ts";

describe("ChangeUserRolesCommand", () => {
  it("builds the user id and parses roles", () => {
    const command = ChangeUserRolesCommand.of("u1", ["admin", "auditor"]);

    assert.equal(command.userId.value, "u1");
    assert.deepEqual([...command.roles], ["admin", "auditor"]);
  });

  it("rejects an unknown role", () => {
    assert.throws(() => ChangeUserRolesCommand.of("u1", ["ghost"]), /Unknown role/);
  });
});
