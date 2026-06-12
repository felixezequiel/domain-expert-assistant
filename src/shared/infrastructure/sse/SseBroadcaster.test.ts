import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { SseBroadcaster, ADMIN_CHANNEL, ADMIN_EVENT_NAME } from "./SseBroadcaster.ts";
import type { DomainEvent } from "../../domain/events/DomainEvent.ts";

class FakeSseService {
  public broadcasts: Array<{ channelId: string; eventName: string; data: unknown }> = [];

  public broadcast(channelId: string, eventName: string, data: unknown): void {
    this.broadcasts.push({ channelId, eventName, data });
  }
}

function createFakeEvent(aggregateId: string, eventName: string): DomainEvent {
  return {
    eventId: randomUUID(),
    eventName,
    occurredAt: new Date(),
    aggregateId,
    causationId: null,
  };
}

describe("SseBroadcaster", () => {
  it("should broadcast each event to its aggregateId channel and to the admin channel", () => {
    const fakeSseService = new FakeSseService();
    const broadcaster = new SseBroadcaster(fakeSseService as never);

    const event1 = createFakeEvent("user-1", "UserCreated");
    const event2 = createFakeEvent("user-1", "AddressAdded");

    broadcaster.broadcastAll([event1, event2]);

    assert.equal(fakeSseService.broadcasts.length, 4);
    assert.equal(fakeSseService.broadcasts[0]!.channelId, "user-1");
    assert.equal(fakeSseService.broadcasts[0]!.eventName, "UserCreated");
    assert.equal(fakeSseService.broadcasts[1]!.channelId, ADMIN_CHANNEL);
    assert.equal(fakeSseService.broadcasts[1]!.eventName, ADMIN_EVENT_NAME);
    assert.equal(fakeSseService.broadcasts[2]!.channelId, "user-1");
    assert.equal(fakeSseService.broadcasts[2]!.eventName, "AddressAdded");
    assert.equal(fakeSseService.broadcasts[3]!.channelId, ADMIN_CHANNEL);
  });

  it("should pass the full event object as data", () => {
    const fakeSseService = new FakeSseService();
    const broadcaster = new SseBroadcaster(fakeSseService as never);

    const event = createFakeEvent("user-1", "UserCreated");

    broadcaster.broadcastAll([event]);

    assert.deepEqual(fakeSseService.broadcasts[0]!.data, event);
  });

  it("should handle empty events array without broadcasting", () => {
    const fakeSseService = new FakeSseService();
    const broadcaster = new SseBroadcaster(fakeSseService as never);

    broadcaster.broadcastAll([]);

    assert.equal(fakeSseService.broadcasts.length, 0);
  });
});
