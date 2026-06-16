import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UserDisabledEvent } from "./UserDisabledEvent.ts";

describe("UserDisabledEvent", () => {
  it("names the event and carries the user id", () => {
    const event = new UserDisabledEvent("user-1");

    assert.equal(event.eventName, "UserDisabled");
    assert.equal(event.aggregateId, "user-1");
  });
});
