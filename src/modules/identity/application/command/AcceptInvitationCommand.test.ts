import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AcceptInvitationCommand } from "./AcceptInvitationCommand.ts";

describe("AcceptInvitationCommand", () => {
  it("keeps the token and password", () => {
    const command = AcceptInvitationCommand.of("the-token", "the-password");

    assert.equal(command.token, "the-token");
    assert.equal(command.password, "the-password");
  });

  it("rejects an empty token or password", () => {
    assert.throws(() => AcceptInvitationCommand.of("", "p"), /token is required/);
    assert.throws(() => AcceptInvitationCommand.of("t", ""), /Password is required/);
  });
});
