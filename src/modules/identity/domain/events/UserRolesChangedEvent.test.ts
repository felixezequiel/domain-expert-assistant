import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UserRolesChangedEvent } from "./UserRolesChangedEvent.ts";

describe("UserRolesChangedEvent", () => {
  it("carries the user id and the new roles", () => {
    const event = new UserRolesChangedEvent("user-1", ["admin", "auditor"]);

    assert.equal(event.eventName, "UserRolesChanged");
    assert.equal(event.aggregateId, "user-1");
    assert.deepEqual([...event.roles], ["admin", "auditor"]);
  });
});
