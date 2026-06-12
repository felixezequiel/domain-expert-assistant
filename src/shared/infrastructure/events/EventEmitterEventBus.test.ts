import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { EventEmitterEventBus } from "./EventEmitterEventBus.ts";
import type { DomainEvent } from "../../domain/events/DomainEvent.ts";

class FakeUserCreatedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventName = "UserCreated";
  public readonly occurredAt: Date;
  public readonly aggregateId: string;
  public readonly causationId: string | null;
  public readonly email: string;

  constructor(aggregateId: string, email: string) {
    this.eventId = randomUUID();
    this.aggregateId = aggregateId;
    this.email = email;
    this.occurredAt = new Date();
    this.causationId = null;
  }
}

class FakeAddressAddedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventName = "AddressAdded";
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

describe("EventEmitterEventBus", () => {
  it("should publish an event and notify the subscriber", async () => {
    const eventBus = new EventEmitterEventBus();
    const receivedEvents: Array<DomainEvent> = [];

    eventBus.subscribe("UserCreated", async (event) => {
      receivedEvents.push(event);
    });

    const event = new FakeUserCreatedEvent("user-1", "john@example.com");
    await eventBus.publish(event);

    assert.equal(receivedEvents.length, 1);
    assert.equal(receivedEvents[0]!.eventName, "UserCreated");
    assert.equal(receivedEvents[0]!.aggregateId, "user-1");
  });

  it("should notify multiple subscribers for the same event", async () => {
    const eventBus = new EventEmitterEventBus();
    let firstSubscriberCalled = false;
    let secondSubscriberCalled = false;

    eventBus.subscribe("UserCreated", async () => {
      firstSubscriberCalled = true;
    });
    eventBus.subscribe("UserCreated", async () => {
      secondSubscriberCalled = true;
    });

    await eventBus.publish(new FakeUserCreatedEvent("user-1", "john@example.com"));

    assert.ok(firstSubscriberCalled);
    assert.ok(secondSubscriberCalled);
  });

  it("should not notify subscribers of different events", async () => {
    const eventBus = new EventEmitterEventBus();
    let addressHandlerCalled = false;

    eventBus.subscribe("AddressAdded", async () => {
      addressHandlerCalled = true;
    });

    await eventBus.publish(new FakeUserCreatedEvent("user-1", "john@example.com"));

    assert.ok(!addressHandlerCalled);
  });

  it("should publish all events sequentially", async () => {
    const eventBus = new EventEmitterEventBus();
    const callOrder: Array<string> = [];

    eventBus.subscribe("UserCreated", async () => {
      callOrder.push("UserCreated");
    });
    eventBus.subscribe("AddressAdded", async () => {
      callOrder.push("AddressAdded");
    });

    const events: Array<DomainEvent> = [
      new FakeUserCreatedEvent("user-1", "john@example.com"),
      new FakeAddressAddedEvent("user-1"),
    ];
    await eventBus.publishAll(events);

    assert.deepEqual(callOrder, ["UserCreated", "AddressAdded"]);
  });

  it("should return the subscriber count for an event", () => {
    const eventBus = new EventEmitterEventBus();

    eventBus.subscribe("UserCreated", async () => {});
    eventBus.subscribe("UserCreated", async () => {});
    eventBus.subscribe("AddressAdded", async () => {});

    assert.equal(eventBus.subscriberCount("UserCreated"), 2);
    assert.equal(eventBus.subscriberCount("AddressAdded"), 1);
    assert.equal(eventBus.subscriberCount("NonExistent"), 0);
  });

  it("should do nothing when publishing an event with no subscribers", async () => {
    const eventBus = new EventEmitterEventBus();

    await eventBus.publish(new FakeUserCreatedEvent("user-1", "john@example.com"));
  });

  it("should propagate errors from subscribers", async () => {
    const eventBus = new EventEmitterEventBus();

    eventBus.subscribe("UserCreated", async () => {
      throw new Error("subscriber failed");
    });

    await assert.rejects(
      () => eventBus.publish(new FakeUserCreatedEvent("user-1", "john@example.com")),
      { message: "subscriber failed" },
    );
  });
});
