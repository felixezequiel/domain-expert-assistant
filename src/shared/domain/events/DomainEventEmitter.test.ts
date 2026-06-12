import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { DomainEventEmitter } from "./DomainEventEmitter.ts";
import type { DomainEvent } from "./DomainEvent.ts";

class FakeEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventName = "FakeEvent";
  public readonly occurredAt: Date;
  public readonly aggregateId: string;
  public readonly causationId: string | null;

  constructor(aggregateId: string) {
    this.eventId = randomUUID();
    this.aggregateId = aggregateId;
    this.occurredAt = new Date();
    this.causationId = null;
  }
}

class FakeEmitter implements DomainEventEmitter {
  private events: Array<DomainEvent> = [];

  public addEvent(event: DomainEvent): void {
    this.events.push(event);
  }

  public getDomainEvents(): ReadonlyArray<DomainEvent> {
    return [...this.events];
  }

  public drainDomainEvents(): ReadonlyArray<DomainEvent> {
    const drained = [...this.events];
    this.events = [];
    return drained;
  }
}

describe("DomainEventEmitter", () => {
  it("should return domain events via getDomainEvents", () => {
    const emitter = new FakeEmitter();
    const event = new FakeEvent("source-1");

    emitter.addEvent(event);

    const events = emitter.getDomainEvents();

    assert.equal(events.length, 1);
    assert.equal(events[0], event);
  });

  it("should drain domain events and clear the internal list", () => {
    const emitter = new FakeEmitter();
    const event = new FakeEvent("source-1");

    emitter.addEvent(event);

    const drained = emitter.drainDomainEvents();
    const afterDrain = emitter.getDomainEvents();

    assert.equal(drained.length, 1);
    assert.equal(drained[0], event);
    assert.equal(afterDrain.length, 0);
  });

  it("should return empty array when no events exist", () => {
    const emitter = new FakeEmitter();

    const events = emitter.getDomainEvents();
    const drained = emitter.drainDomainEvents();

    assert.equal(events.length, 0);
    assert.equal(drained.length, 0);
  });
});
