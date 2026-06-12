import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { EventEmittingAdapter } from "./EventEmittingAdapter.ts";
import type { DomainEvent } from "../../domain/events/DomainEvent.ts";
import type { DomainEventEmitter } from "../../domain/events/DomainEventEmitter.ts";

class FakeEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventName = "FakeAdapterEvent";
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

class ConcreteAdapter extends EventEmittingAdapter {
  public emitEvent(event: DomainEvent): void {
    this.addDomainEvent(event);
  }
}

describe("EventEmittingAdapter", () => {
  afterEach(() => {
    EventEmittingAdapter.setOnTrack(null);
  });

  it("should store domain events via addDomainEvent", () => {
    const adapter = new ConcreteAdapter();
    const event = new FakeEvent("source-1");

    adapter.emitEvent(event);

    const events = adapter.getDomainEvents();

    assert.equal(events.length, 1);
    assert.equal(events[0], event);
  });

  it("should drain domain events and clear the internal list", () => {
    const adapter = new ConcreteAdapter();
    const event = new FakeEvent("source-1");

    adapter.emitEvent(event);

    const drained = adapter.drainDomainEvents();
    const afterDrain = adapter.getDomainEvents();

    assert.equal(drained.length, 1);
    assert.equal(drained[0], event);
    assert.equal(afterDrain.length, 0);
  });

  it("should return empty array when no events exist", () => {
    const adapter = new ConcreteAdapter();

    const events = adapter.getDomainEvents();
    const drained = adapter.drainDomainEvents();

    assert.equal(events.length, 0);
    assert.equal(drained.length, 0);
  });

  it("should call onTrack callback on the first addDomainEvent", () => {
    const trackedSources: Array<DomainEventEmitter> = [];
    EventEmittingAdapter.setOnTrack((source) => {
      trackedSources.push(source);
    });

    const adapter = new ConcreteAdapter();
    const firstEvent = new FakeEvent("source-1");
    const secondEvent = new FakeEvent("source-1");

    adapter.emitEvent(firstEvent);
    adapter.emitEvent(secondEvent);

    assert.equal(trackedSources.length, 1);
    assert.equal(trackedSources[0], adapter);
  });

  it("should reset tracked flag after drainDomainEvents", () => {
    const trackedSources: Array<DomainEventEmitter> = [];
    EventEmittingAdapter.setOnTrack((source) => {
      trackedSources.push(source);
    });

    const adapter = new ConcreteAdapter();

    adapter.emitEvent(new FakeEvent("source-1"));
    adapter.drainDomainEvents();
    adapter.emitEvent(new FakeEvent("source-1"));

    assert.equal(trackedSources.length, 2);
  });

  it("should not call onTrack when callback is null", () => {
    EventEmittingAdapter.setOnTrack(null);

    const adapter = new ConcreteAdapter();

    assert.doesNotThrow(() => {
      adapter.emitEvent(new FakeEvent("source-1"));
    });
  });
});
