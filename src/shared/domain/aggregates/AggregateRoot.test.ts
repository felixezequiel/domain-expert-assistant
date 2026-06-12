import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AggregateRoot } from "./AggregateRoot.ts";
import { Identifier } from "../identifiers/Identifier.ts";
import type { DomainEvent } from "../events/DomainEvent.ts";

class OrderId extends Identifier {}

interface OrderProps {
  readonly customerName: string;
  readonly total: number;
}

class OrderCreatedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventName = "OrderCreated";
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

class OrderShippedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventName = "OrderShipped";
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

class Order extends AggregateRoot<OrderId, OrderProps> {
  public get customerName(): string {
    return this.props.customerName;
  }

  public get total(): number {
    return this.props.total;
  }

  public static create(id: OrderId, customerName: string, total: number): Order {
    const order = new Order(id, { customerName, total });
    order.addDomainEvent(new OrderCreatedEvent(id.value));
    return order;
  }

  public ship(): void {
    this.addDomainEvent(new OrderShippedEvent(this.id.value));
  }
}

describe("AggregateRoot", () => {
  it("should extend Entity with id and props", () => {
    const orderId = new OrderId("order-1");
    const order = new Order(orderId, { customerName: "John", total: 100 });

    assert.equal(order.id.value, "order-1");
    assert.equal(order.customerName, "John");
  });

  it("should collect domain events", () => {
    const order = Order.create(new OrderId("order-1"), "John", 100);

    const events = order.getDomainEvents();

    assert.equal(events.length, 1);
    assert.equal(events[0]!.eventName, "OrderCreated");
  });

  it("should accumulate multiple domain events", () => {
    const order = Order.create(new OrderId("order-1"), "John", 100);
    order.ship();

    const events = order.getDomainEvents();

    assert.equal(events.length, 2);
    assert.equal(events[0]!.eventName, "OrderCreated");
    assert.equal(events[1]!.eventName, "OrderShipped");
  });

  it("should drain domain events and clear the internal list", () => {
    const order = Order.create(new OrderId("order-1"), "John", 100);
    order.ship();

    const drainedEvents = order.drainDomainEvents();
    const remainingEvents = order.getDomainEvents();

    assert.equal(drainedEvents.length, 2);
    assert.equal(remainingEvents.length, 0);
  });

  it("should return an empty list when no events were added", () => {
    const order = new Order(new OrderId("order-1"), { customerName: "John", total: 100 });

    const events = order.getDomainEvents();

    assert.equal(events.length, 0);
  });

  it("should preserve equality by id (inherited from Entity)", () => {
    const firstOrder = new Order(new OrderId("order-1"), { customerName: "John", total: 100 });
    const secondOrder = new Order(new OrderId("order-1"), { customerName: "Jane", total: 200 });

    assert.ok(firstOrder.equals(secondOrder));
  });

  it("should call onTrack callback when a domain event is added", () => {
    const trackedAggregates: Array<AggregateRoot<Identifier, object>> = [];
    AggregateRoot.setOnTrack((aggregate) => {
      trackedAggregates.push(aggregate);
    });

    const order = Order.create(new OrderId("order-1"), "John", 100);

    assert.equal(trackedAggregates.length, 1);
    assert.equal(trackedAggregates[0], order);

    AggregateRoot.setOnTrack(null);
  });

  it("should call onTrack only once per aggregate even with multiple events", () => {
    const trackedAggregates: Array<AggregateRoot<Identifier, object>> = [];
    AggregateRoot.setOnTrack((aggregate) => {
      trackedAggregates.push(aggregate);
    });

    const order = Order.create(new OrderId("order-1"), "John", 100);
    order.ship();

    assert.equal(trackedAggregates.length, 1);
    assert.equal(trackedAggregates[0], order);

    AggregateRoot.setOnTrack(null);
  });

  it("should not fail when no onTrack callback is set", () => {
    AggregateRoot.setOnTrack(null);

    const order = Order.create(new OrderId("order-1"), "John", 100);

    assert.equal(order.getDomainEvents().length, 1);
  });

  it("should reset tracked state after draining events", () => {
    const trackedAggregates: Array<AggregateRoot<Identifier, object>> = [];
    AggregateRoot.setOnTrack((aggregate) => {
      trackedAggregates.push(aggregate);
    });

    const order = Order.create(new OrderId("order-1"), "John", 100);
    order.drainDomainEvents();

    order.ship();

    assert.equal(trackedAggregates.length, 2);
    assert.equal(trackedAggregates[0], order);
    assert.equal(trackedAggregates[1], order);

    AggregateRoot.setOnTrack(null);
  });
});
