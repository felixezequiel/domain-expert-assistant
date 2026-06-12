import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { WelcomeEmailFailedEvent } from "./WelcomeEmailFailedEvent.ts";

describe("WelcomeEmailFailedEvent", () => {
  it("should have the event name WelcomeEmailFailed", () => {
    const event = new WelcomeEmailFailedEvent("user-1", "user@example.com", "SMTP timeout");

    assert.equal(event.eventName, "WelcomeEmailFailed");
  });

  it("should store the aggregate id", () => {
    const event = new WelcomeEmailFailedEvent("user-1", "user@example.com", "SMTP timeout");

    assert.equal(event.aggregateId, "user-1");
  });

  it("should store the email", () => {
    const event = new WelcomeEmailFailedEvent("user-1", "user@example.com", "SMTP timeout");

    assert.equal(event.email, "user@example.com");
  });

  it("should store the failure reason", () => {
    const event = new WelcomeEmailFailedEvent("user-1", "user@example.com", "SMTP timeout");

    assert.equal(event.reason, "SMTP timeout");
  });

  it("should have an occurredAt timestamp", () => {
    const event = new WelcomeEmailFailedEvent("user-1", "user@example.com", "SMTP timeout");

    assert.ok(event.occurredAt instanceof Date);
  });

  it("should generate an eventId as a UUID string", () => {
    const event = new WelcomeEmailFailedEvent("user-1", "user@example.com", "SMTP timeout");

    assert.equal(typeof event.eventId, "string");
    assert.ok(event.eventId.length > 0);
  });

  it("should generate a unique eventId for each instance", () => {
    const firstEvent = new WelcomeEmailFailedEvent("user-1", "u@e.com", "reason1");
    const secondEvent = new WelcomeEmailFailedEvent("user-2", "o@e.com", "reason2");

    assert.notEqual(firstEvent.eventId, secondEvent.eventId);
  });

  it("should have causationId as null by default", () => {
    const event = new WelcomeEmailFailedEvent("user-1", "user@example.com", "SMTP timeout");

    assert.equal(event.causationId, null);
  });

  it("should accept a causationId when provided", () => {
    const causingEventId = randomUUID();
    const event = new WelcomeEmailFailedEvent(
      "user-1",
      "user@example.com",
      "SMTP timeout",
      causingEventId,
    );

    assert.equal(event.causationId, causingEventId);
  });
});
