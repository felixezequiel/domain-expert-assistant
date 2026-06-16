import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UserInvitedEvent } from "./UserInvitedEvent.ts";

describe("UserInvitedEvent", () => {
  it("carries the user id, email and roles", () => {
    const event = new UserInvitedEvent("user-1", "a@b.com", ["curator"]);

    assert.equal(event.eventName, "UserInvited");
    assert.equal(event.aggregateId, "user-1");
    assert.equal(event.email, "a@b.com");
    assert.deepEqual([...event.roles], ["curator"]);
  });
});
