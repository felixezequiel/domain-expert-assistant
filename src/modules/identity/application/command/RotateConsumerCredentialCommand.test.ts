import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RotateConsumerCredentialCommand } from "./RotateConsumerCredentialCommand.ts";

describe("RotateConsumerCredentialCommand", () => {
  it("wraps the credential id", () => {
    assert.equal(RotateConsumerCredentialCommand.of("cred-1").credentialId.value, "cred-1");
  });
});
