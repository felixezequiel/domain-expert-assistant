import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NoOpSseBroadcaster } from "./NoOpSseBroadcaster.ts";
import type { DomainEvent } from "../../domain/events/DomainEvent.ts";

function createFakeEvent(aggregateId: string): DomainEvent {
  return {
    eventId: randomUUID(),
    eventName: "FakeEvent",
    occurredAt: new Date(),
    aggregateId,
    causationId: null,
  };
}

describe("NoOpSseBroadcaster", () => {
  it("should implement SseBroadcasterPort without throwing", () => {
    const broadcaster = new NoOpSseBroadcaster();
    const events = [createFakeEvent("agg-1"), createFakeEvent("agg-2")];

    assert.doesNotThrow(() => broadcaster.broadcastAll(events));
  });

  it("should handle empty events array", () => {
    const broadcaster = new NoOpSseBroadcaster();

    assert.doesNotThrow(() => broadcaster.broadcastAll([]));
  });
});
