import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MikroOrmEventStore } from "./MikroOrmEventStore.ts";
import type { SystemEventEntity } from "./SystemEventEntity.ts";
import type { DomainEvent } from "../../../../domain/events/DomainEvent.ts";
import type { EntityManagerProvider } from "../EntityManagerProvider.ts";
import type { EntityManager } from "@mikro-orm/core";

class FakeEntityManager {
  public persistedEntities: Array<SystemEventEntity> = [];

  public persist(entity: SystemEventEntity): void {
    this.persistedEntities.push(entity);
  }
}

class FakeEntityManagerProvider implements EntityManagerProvider {
  public readonly fakeEntityManager: FakeEntityManager;

  constructor(fakeEntityManager: FakeEntityManager) {
    this.fakeEntityManager = fakeEntityManager;
  }

  public getEntityManager(): EntityManager {
    return this.fakeEntityManager as unknown as EntityManager;
  }

  public setEntityManager(): void {
    // no-op for test
  }

  public runWithScope<T>(callback: () => Promise<T>): Promise<T> {
    return callback();
  }
}

describe("MikroOrmEventStore", () => {
  let fakeEntityManager: FakeEntityManager;
  let entityManagerProvider: FakeEntityManagerProvider;
  let eventStore: MikroOrmEventStore;

  beforeEach(() => {
    fakeEntityManager = new FakeEntityManager();
    entityManagerProvider = new FakeEntityManagerProvider(fakeEntityManager);
    eventStore = new MikroOrmEventStore(entityManagerProvider);
  });

  it("should persist each domain event as a SystemEventEntity", async () => {
    const occurredAt = new Date("2026-02-21T10:00:00.000Z");
    const firstEventId = randomUUID();
    const secondEventId = randomUUID();

    const events: ReadonlyArray<DomainEvent> = [
      {
        eventId: firstEventId,
        eventName: "UserCreated",
        occurredAt: occurredAt,
        aggregateId: "user-1",
        causationId: null,
      },
      {
        eventId: secondEventId,
        eventName: "AddressAdded",
        occurredAt: occurredAt,
        aggregateId: "user-1",
        causationId: null,
      },
    ];

    await eventStore.saveAll(events);

    assert.equal(fakeEntityManager.persistedEntities.length, 2);

    const firstEntity = fakeEntityManager.persistedEntities[0]!;
    assert.equal(firstEntity.eventName, "UserCreated");
    assert.equal(firstEntity.aggregateId, "user-1");
    assert.equal(firstEntity.occurredAt, occurredAt.toISOString());
    assert.ok(firstEntity.id.length > 0);

    const secondEntity = fakeEntityManager.persistedEntities[1]!;
    assert.equal(secondEntity.eventName, "AddressAdded");
    assert.equal(secondEntity.aggregateId, "user-1");
  });

  it("should serialize the full event as JSON payload", async () => {
    const occurredAt = new Date("2026-02-21T10:00:00.000Z");
    const eventId = randomUUID();

    const eventWithExtraFields = {
      eventId: eventId,
      eventName: "UserCreated",
      occurredAt: occurredAt,
      aggregateId: "user-1",
      causationId: null,
      email: "john@example.com",
    };

    await eventStore.saveAll([eventWithExtraFields]);

    const persistedEntity = fakeEntityManager.persistedEntities[0]!;
    const parsedPayload = JSON.parse(persistedEntity.payload);

    assert.equal(parsedPayload.eventName, "UserCreated");
    assert.equal(parsedPayload.aggregateId, "user-1");
    assert.equal(parsedPayload.email, "john@example.com");
  });

  it("should not persist anything when events array is empty", async () => {
    await eventStore.saveAll([]);

    assert.equal(fakeEntityManager.persistedEntities.length, 0);
  });

  it("should use the eventId from the domain event as the entity id", async () => {
    const occurredAt = new Date("2026-02-21T10:00:00.000Z");
    const eventId = randomUUID();

    const events: ReadonlyArray<DomainEvent> = [
      {
        eventId: eventId,
        eventName: "UserCreated",
        occurredAt: occurredAt,
        aggregateId: "user-1",
        causationId: null,
      },
    ];

    await eventStore.saveAll(events);

    const persistedEntity = fakeEntityManager.persistedEntities[0]!;
    assert.equal(persistedEntity.id, eventId);
  });

  it("should map causationId from the domain event to the entity", async () => {
    const occurredAt = new Date("2026-02-21T10:00:00.000Z");
    const eventId = randomUUID();
    const causingEventId = randomUUID();

    const events: ReadonlyArray<DomainEvent> = [
      {
        eventId: eventId,
        eventName: "AddressAdded",
        occurredAt: occurredAt,
        aggregateId: "user-1",
        causationId: causingEventId,
      },
    ];

    await eventStore.saveAll(events);

    const persistedEntity = fakeEntityManager.persistedEntities[0]!;
    assert.equal(persistedEntity.causationId, causingEventId);
  });

  it("should persist null causationId for root events", async () => {
    const occurredAt = new Date("2026-02-21T10:00:00.000Z");
    const eventId = randomUUID();

    const events: ReadonlyArray<DomainEvent> = [
      {
        eventId: eventId,
        eventName: "UserCreated",
        occurredAt: occurredAt,
        aggregateId: "user-1",
        causationId: null,
      },
    ];

    await eventStore.saveAll(events);

    const persistedEntity = fakeEntityManager.persistedEntities[0]!;
    assert.equal(persistedEntity.causationId, null);
  });

  it("should preserve unique eventIds from each domain event", async () => {
    const occurredAt = new Date("2026-02-21T10:00:00.000Z");
    const firstEventId = randomUUID();
    const secondEventId = randomUUID();

    const events: ReadonlyArray<DomainEvent> = [
      {
        eventId: firstEventId,
        eventName: "EventA",
        occurredAt: occurredAt,
        aggregateId: "agg-1",
        causationId: null,
      },
      {
        eventId: secondEventId,
        eventName: "EventB",
        occurredAt: occurredAt,
        aggregateId: "agg-2",
        causationId: null,
      },
    ];

    await eventStore.saveAll(events);

    const firstId = fakeEntityManager.persistedEntities[0]!.id;
    const secondId = fakeEntityManager.persistedEntities[1]!.id;

    assert.equal(firstId, firstEventId);
    assert.equal(secondId, secondEventId);
    assert.notEqual(firstId, secondId);
  });
});
