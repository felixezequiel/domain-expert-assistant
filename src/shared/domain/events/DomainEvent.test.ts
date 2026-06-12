import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { DomainEvent } from "./DomainEvent.ts";

class OrderPlacedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventName = "OrderPlaced";
  public readonly occurredAt: Date;
  public readonly aggregateId: string;
  public readonly causationId: string | null;
  public readonly amount: number;

  constructor(aggregateId: string, amount: number, causationId: string | null = null) {
    this.eventId = randomUUID();
    this.aggregateId = aggregateId;
    this.amount = amount;
    this.occurredAt = new Date();
    this.causationId = causationId;
  }
}

describe("DomainEvent", () => {
  it("should have an eventId as a UUID string", () => {
    const event = new OrderPlacedEvent("order-1", 100);

    assert.equal(typeof event.eventId, "string");
    assert.ok(event.eventId.length > 0);
  });

  it("should generate a unique eventId for each instance", () => {
    const firstEvent = new OrderPlacedEvent("order-1", 100);
    const secondEvent = new OrderPlacedEvent("order-2", 200);

    assert.notEqual(firstEvent.eventId, secondEvent.eventId);
  });

  it("should have an eventName", () => {
    const event = new OrderPlacedEvent("order-1", 100);

    assert.equal(event.eventName, "OrderPlaced");
  });

  it("should have an occurredAt timestamp", () => {
    const event = new OrderPlacedEvent("order-1", 100);

    assert.ok(event.occurredAt instanceof Date);
  });

  it("should have an aggregateId", () => {
    const event = new OrderPlacedEvent("order-1", 100);

    assert.equal(event.aggregateId, "order-1");
  });

  it("should have causationId as null by default", () => {
    const event = new OrderPlacedEvent("order-1", 100);

    assert.equal(event.causationId, null);
  });

  it("should accept a causationId when provided", () => {
    const causingEventId = randomUUID();
    const event = new OrderPlacedEvent("order-1", 100, causingEventId);

    assert.equal(event.causationId, causingEventId);
  });

  it("should carry domain-specific data", () => {
    const event = new OrderPlacedEvent("order-1", 250);

    assert.equal(event.amount, 250);
  });
});
