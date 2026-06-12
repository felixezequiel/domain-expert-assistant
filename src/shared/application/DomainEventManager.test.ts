import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DomainEventManager } from "./DomainEventManager.ts";
import type { DomainEvent } from "../domain/events/DomainEvent.ts";

class UserCreatedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventName = "UserCreated";
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

class UserDeletedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventName = "UserDeleted";
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

describe("DomainEventManager", () => {
  it("should register a handler and dispatch an event to it", async () => {
    const manager = new DomainEventManager();
    const receivedEvents: Array<DomainEvent> = [];

    manager.register("UserCreated", async (event) => {
      receivedEvents.push(event);
    });

    const event = new UserCreatedEvent("user-1");
    await manager.dispatch(event);

    assert.equal(receivedEvents.length, 1);
    assert.equal(receivedEvents[0]!.aggregateId, "user-1");
  });

  it("should dispatch to multiple handlers for the same event", async () => {
    const manager = new DomainEventManager();
    let firstHandlerCalled = false;
    let secondHandlerCalled = false;

    manager.register("UserCreated", async () => {
      firstHandlerCalled = true;
    });
    manager.register("UserCreated", async () => {
      secondHandlerCalled = true;
    });

    await manager.dispatch(new UserCreatedEvent("user-1"));

    assert.ok(firstHandlerCalled);
    assert.ok(secondHandlerCalled);
  });

  it("should not dispatch to handlers registered for a different event", async () => {
    const manager = new DomainEventManager();
    let deleteHandlerCalled = false;

    manager.register("UserDeleted", async () => {
      deleteHandlerCalled = true;
    });

    await manager.dispatch(new UserCreatedEvent("user-1"));

    assert.ok(!deleteHandlerCalled);
  });

  it("should dispatch all events sequentially preserving order", async () => {
    const manager = new DomainEventManager();
    const callOrder: Array<string> = [];

    manager.register("UserCreated", async () => {
      callOrder.push("created");
    });
    manager.register("UserDeleted", async () => {
      callOrder.push("deleted");
    });

    const events: Array<DomainEvent> = [
      new UserCreatedEvent("user-1"),
      new UserDeletedEvent("user-2"),
    ];
    await manager.dispatchAll(events);

    assert.deepEqual(callOrder, ["created", "deleted"]);
  });

  it("should stop dispatching when a handler throws an error", async () => {
    const manager = new DomainEventManager();
    let secondHandlerCalled = false;

    manager.register("UserCreated", async () => {
      throw new Error("handler failed");
    });
    manager.register("UserDeleted", async () => {
      secondHandlerCalled = true;
    });

    const events: Array<DomainEvent> = [
      new UserCreatedEvent("user-1"),
      new UserDeletedEvent("user-2"),
    ];

    await assert.rejects(() => manager.dispatchAll(events), {
      message: "handler failed",
    });
    assert.ok(!secondHandlerCalled);
  });

  it("should clear all handlers", async () => {
    const manager = new DomainEventManager();
    let handlerCalled = false;

    manager.register("UserCreated", async () => {
      handlerCalled = true;
    });

    manager.clear();

    await manager.dispatch(new UserCreatedEvent("user-1"));

    assert.ok(!handlerCalled);
  });

  it("should do nothing when dispatching an event with no registered handlers", async () => {
    const manager = new DomainEventManager();

    await manager.dispatch(new UserCreatedEvent("user-1"));
  });
});
