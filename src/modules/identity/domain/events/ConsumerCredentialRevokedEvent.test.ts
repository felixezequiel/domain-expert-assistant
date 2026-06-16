import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ConsumerCredentialRevokedEvent } from "./ConsumerCredentialRevokedEvent.ts";

describe("ConsumerCredentialRevokedEvent", () => {
  it("names the event and carries the credential id", () => {
    const event = new ConsumerCredentialRevokedEvent("cred-1");

    assert.equal(event.eventName, "ConsumerCredentialRevoked");
    assert.equal(event.aggregateId, "cred-1");
  });
});
