import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CollectionRenamedEvent } from "./CollectionRenamedEvent.ts";

describe("CollectionRenamedEvent", () => {
  it("carries the collection id and new name", () => {
    const event = new CollectionRenamedEvent("col-1", "Renamed");
    assert.equal(event.eventName, "CollectionRenamed");
    assert.equal(event.aggregateId, "col-1");
    assert.equal(event.name, "Renamed");
  });
});
