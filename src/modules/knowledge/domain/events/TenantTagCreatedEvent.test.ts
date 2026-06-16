import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TenantTagCreatedEvent } from "./TenantTagCreatedEvent.ts";

describe("TenantTagCreatedEvent", () => {
  it("carries the tag id, slug and label", () => {
    const event = new TenantTagCreatedEvent("tag-1", "refunds", "Refunds");
    assert.equal(event.eventName, "TenantTagCreated");
    assert.equal(event.aggregateId, "tag-1");
    assert.equal(event.slug, "refunds");
    assert.equal(event.label, "Refunds");
  });
});
