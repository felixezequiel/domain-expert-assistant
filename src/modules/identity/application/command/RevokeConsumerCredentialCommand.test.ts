import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RevokeConsumerCredentialCommand } from "./RevokeConsumerCredentialCommand.ts";

describe("RevokeConsumerCredentialCommand", () => {
  it("wraps the credential id", () => {
    assert.equal(RevokeConsumerCredentialCommand.of("cred-1").credentialId.value, "cred-1");
  });
});
