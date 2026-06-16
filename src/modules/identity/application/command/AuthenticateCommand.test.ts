import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AuthenticateCommand } from "./AuthenticateCommand.ts";

describe("AuthenticateCommand", () => {
  it("normalises the email and keeps the password as-is", () => {
    const command = AuthenticateCommand.of("  Ada@Acme.com ", "  s3cret ");

    assert.equal(command.email, "ada@acme.com");
    assert.equal(command.password, "  s3cret ");
  });

  it("does not throw on a malformed email (kept indistinguishable downstream)", () => {
    assert.doesNotThrow(() => AuthenticateCommand.of("not-an-email", "x"));
  });
});
