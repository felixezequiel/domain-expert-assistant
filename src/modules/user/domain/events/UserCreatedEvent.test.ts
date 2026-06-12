import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { UserCreatedEvent } from "./UserCreatedEvent.ts";

describe("UserCreatedEvent", () => {
  it("should have the event name UserCreated", () => {
    const event = new UserCreatedEvent("user-1", "user@example.com");

    assert.equal(event.eventName, "UserCreated");
  });

  it("should store the aggregate id", () => {
    const event = new UserCreatedEvent("user-1", "user@example.com");

    assert.equal(event.aggregateId, "user-1");
  });

  it("should store the email", () => {
    const event = new UserCreatedEvent("user-1", "user@example.com");

    assert.equal(event.email, "user@example.com");
  });

  it("should have an occurredAt timestamp", () => {
    const event = new UserCreatedEvent("user-1", "user@example.com");

    assert.ok(event.occurredAt instanceof Date);
  });

  it("should generate an eventId as a UUID string", () => {
    const event = new UserCreatedEvent("user-1", "user@example.com");

    assert.equal(typeof event.eventId, "string");
    assert.ok(event.eventId.length > 0);
  });

  it("should generate a unique eventId for each instance", () => {
    const firstEvent = new UserCreatedEvent("user-1", "user@example.com");
    const secondEvent = new UserCreatedEvent("user-2", "other@example.com");

    assert.notEqual(firstEvent.eventId, secondEvent.eventId);
  });

  it("should have causationId as null by default", () => {
    const event = new UserCreatedEvent("user-1", "user@example.com");

    assert.equal(event.causationId, null);
  });

  it("should accept a causationId when provided", () => {
    const causingEventId = randomUUID();
    const event = new UserCreatedEvent("user-1", "user@example.com", causingEventId);

    assert.equal(event.causationId, causingEventId);
  });
});
