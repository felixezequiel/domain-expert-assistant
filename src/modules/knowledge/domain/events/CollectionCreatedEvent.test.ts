import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CollectionCreatedEvent } from "./CollectionCreatedEvent.ts";

describe("CollectionCreatedEvent", () => {
  it("carries the collection id, name and creator", () => {
    const event = new CollectionCreatedEvent("col-1", "Policies", "user-1");
    assert.equal(event.eventName, "CollectionCreated");
    assert.equal(event.aggregateId, "col-1");
    assert.equal(event.name, "Policies");
    assert.equal(event.createdBy, "user-1");
  });
});
