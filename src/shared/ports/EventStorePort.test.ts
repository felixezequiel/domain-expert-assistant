import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EventStorePort } from "./EventStorePort.ts";
import type { DomainEvent } from "../domain/events/DomainEvent.ts";

describe("EventStorePort", () => {
  it("should define a contract for saving domain events", () => {
    const savedEvents: Array<DomainEvent> = [];

    const fakeEventStore: EventStorePort = {
      saveAll: async (events: ReadonlyArray<DomainEvent>): Promise<void> => {
        for (const event of events) {
          savedEvents.push(event);
        }
      },
    };

    assert.ok(fakeEventStore);
    assert.equal(typeof fakeEventStore.saveAll, "function");
  });

  it("should accept a readonly array of domain events", async () => {
    const savedEvents: Array<DomainEvent> = [];

    const fakeEventStore: EventStorePort = {
      saveAll: async (events: ReadonlyArray<DomainEvent>): Promise<void> => {
        for (const event of events) {
          savedEvents.push(event);
        }
      },
    };

    const events: ReadonlyArray<DomainEvent> = [
      {
        eventId: "evt-1",
        eventName: "TestEvent",
        occurredAt: new Date(),
        aggregateId: "agg-1",
        causationId: null,
      },
    ];

    await fakeEventStore.saveAll(events);

    assert.equal(savedEvents.length, 1);
    assert.equal(savedEvents[0]!.eventName, "TestEvent");
    assert.equal(savedEvents[0]!.aggregateId, "agg-1");
  });
});
