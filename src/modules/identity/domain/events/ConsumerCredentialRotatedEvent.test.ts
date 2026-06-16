import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ConsumerCredentialRotatedEvent } from "./ConsumerCredentialRotatedEvent.ts";

describe("ConsumerCredentialRotatedEvent", () => {
  it("carries the credential id and the new key prefix", () => {
    const event = new ConsumerCredentialRotatedEvent("cred-1", "dea_wxyz");

    assert.equal(event.eventName, "ConsumerCredentialRotated");
    assert.equal(event.aggregateId, "cred-1");
    assert.equal(event.keyPrefix, "dea_wxyz");
  });
});
