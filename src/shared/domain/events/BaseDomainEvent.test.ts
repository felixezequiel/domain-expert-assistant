import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BaseDomainEvent } from "./BaseDomainEvent.ts";

class SampleEvent extends BaseDomainEvent {
  public readonly eventName = "Sample";
  public readonly payloadField: string;

  constructor(aggregateId: string, payloadField: string, causationId: string | null = null) {
    super(aggregateId, causationId);
    this.payloadField = payloadField;
  }
}

describe("BaseDomainEvent", () => {
  it("generates an eventId and occurredAt automatically", () => {
    const event = new SampleEvent("agg-1", "hello");

    assert.equal(typeof event.eventId, "string");
    assert.ok(event.eventId.length > 0);
    assert.ok(event.occurredAt instanceof Date);
  });

  it("carries aggregateId, causationId and the subclass payload", () => {
    const event = new SampleEvent("agg-1", "hello", "cause-1");

    assert.equal(event.aggregateId, "agg-1");
    assert.equal(event.causationId, "cause-1");
    assert.equal(event.payloadField, "hello");
    assert.equal(event.eventName, "Sample");
  });

  it("defaults causationId to null", () => {
    const event = new SampleEvent("agg-1", "hello");

    assert.equal(event.causationId, null);
  });

  it("starts with an empty envelope (stamped later by the application layer)", () => {
    const event = new SampleEvent("agg-1", "hello");

    assert.equal(event.companyId, null);
    assert.equal(event.actorId, null);
    assert.equal(event.actorType, null);
  });

  it("serializes the envelope fields as own enumerable properties (for the event store payload)", () => {
    const event = new SampleEvent("agg-1", "hello");

    const serialized = JSON.parse(JSON.stringify(event)) as Record<string, unknown>;

    assert.ok("companyId" in serialized);
    assert.ok("actorId" in serialized);
    assert.ok("actorType" in serialized);
    assert.equal(serialized.payloadField, "hello");
  });
});
