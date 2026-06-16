import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CredentialId } from "./CredentialId.ts";

describe("CredentialId", () => {
  it("wraps a value and compares equal by value", () => {
    assert.equal(new CredentialId("cred-1").value, "cred-1");
    assert.ok(new CredentialId("cred-1").equals(new CredentialId("cred-1")));
  });
});
