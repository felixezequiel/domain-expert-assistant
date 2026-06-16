import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TenantTagRemovedEvent } from "./TenantTagRemovedEvent.ts";

describe("TenantTagRemovedEvent", () => {
  it("names the event and carries the tag id", () => {
    const event = new TenantTagRemovedEvent("tag-1");
    assert.equal(event.eventName, "TenantTagRemoved");
    assert.equal(event.aggregateId, "tag-1");
  });
});
