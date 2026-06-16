import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UserActivatedEvent } from "./UserActivatedEvent.ts";

describe("UserActivatedEvent", () => {
  it("names the event and carries the user id", () => {
    const event = new UserActivatedEvent("user-1");

    assert.equal(event.eventName, "UserActivated");
    assert.equal(event.aggregateId, "user-1");
  });
});
