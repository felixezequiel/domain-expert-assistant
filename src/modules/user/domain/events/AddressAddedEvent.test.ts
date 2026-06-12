import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AddressAddedEvent } from "./AddressAddedEvent.ts";

describe("AddressAddedEvent", () => {
  it("should have the event name AddressAdded", () => {
    const event = new AddressAddedEvent("user-1", "addr-1");

    assert.equal(event.eventName, "AddressAdded");
  });

  it("should store the aggregate id", () => {
    const event = new AddressAddedEvent("user-1", "addr-1");

    assert.equal(event.aggregateId, "user-1");
  });

  it("should store the address id", () => {
    const event = new AddressAddedEvent("user-1", "addr-1");

    assert.equal(event.addressId, "addr-1");
  });

  it("should have an occurredAt timestamp", () => {
    const event = new AddressAddedEvent("user-1", "addr-1");

    assert.ok(event.occurredAt instanceof Date);
  });

  it("should generate an eventId as a UUID string", () => {
    const event = new AddressAddedEvent("user-1", "addr-1");

    assert.equal(typeof event.eventId, "string");
    assert.ok(event.eventId.length > 0);
  });

  it("should generate a unique eventId for each instance", () => {
    const firstEvent = new AddressAddedEvent("user-1", "addr-1");
    const secondEvent = new AddressAddedEvent("user-1", "addr-2");

    assert.notEqual(firstEvent.eventId, secondEvent.eventId);
  });

  it("should have causationId as null by default", () => {
    const event = new AddressAddedEvent("user-1", "addr-1");

    assert.equal(event.causationId, null);
  });

  it("should accept a causationId when provided", () => {
    const causingEventId = randomUUID();
    const event = new AddressAddedEvent("user-1", "addr-1", causingEventId);

    assert.equal(event.causationId, causingEventId);
  });
});
