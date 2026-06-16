import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ConsumerCredentialIssuedEvent } from "./ConsumerCredentialIssuedEvent.ts";

describe("ConsumerCredentialIssuedEvent", () => {
  it("carries the credential id, key prefix and issuer", () => {
    const event = new ConsumerCredentialIssuedEvent("cred-1", "dea_abcd", "user-1");

    assert.equal(event.eventName, "ConsumerCredentialIssued");
    assert.equal(event.aggregateId, "cred-1");
    assert.equal(event.keyPrefix, "dea_abcd");
    assert.equal(event.createdBy, "user-1");
  });
});
