import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MikroOrmUnitOfWork } from "./MikroOrmUnitOfWork.ts";
import { AggregateTracker } from "../AggregateTracker.ts";
import type { AggregatePersister } from "../AggregatePersister.ts";
import type { EntityManagerProvider } from "./EntityManagerProvider.ts";
import type { AggregateRoot } from "../../../domain/aggregates/AggregateRoot.ts";
import type { Identifier } from "../../../domain/identifiers/Identifier.ts";
import { AggregateRoot as AggregateRootClass } from "../../../domain/aggregates/AggregateRoot.ts";
import { Identifier as IdentifierClass } from "../../../domain/identifiers/Identifier.ts";
import type { DomainEvent } from "../../../domain/events/DomainEvent.ts";

class FakeId extends IdentifierClass {}

interface FakeProps {
  readonly name: string;
}

class FakeCreatedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventName = "FakeCreated";
  public readonly occurredAt = new Date();
  public readonly aggregateId: string;
  public readonly causationId: string | null;

  constructor(aggregateId: string) {
    this.eventId = randomUUID();
    this.aggregateId = aggregateId;
    this.causationId = null;
  }
}

class FakeAggregate extends AggregateRootClass<FakeId, FakeProps> {
  public static create(id: FakeId, name: string): FakeAggregate {
    const aggregate = new FakeAggregate(id, { name });
    aggregate.addDomainEvent(new FakeCreatedEvent(id.value));
    return aggregate;
  }

  public requestDeletion(): void {
    this.markForDeletion();
  }
}

class FakePersister implements AggregatePersister {
  public persistedAggregates: Array<AggregateRoot<Identifier, object>> = [];
  public deletedAggregates: Array<AggregateRoot<Identifier, object>> = [];

  public supports(): boolean {
    return true;
  }

  public async persist(aggregate: AggregateRoot<Identifier, object>): Promise<void> {
    this.persistedAggregates.push(aggregate);
  }

  public async delete(aggregate: AggregateRoot<Identifier, object>): Promise<void> {
    this.deletedAggregates.push(aggregate);
  }
}

class FakeEntityManager {
  public forkCalled = false;
  public clearCalled = false;
  public transactionalCalled = false;

  public fork(): FakeEntityManager {
    const forked = new FakeEntityManager();
    forked.forkCalled = true;
    return forked;
  }

  public async transactional<T>(callback: (em: FakeEntityManager) => Promise<T>): Promise<T> {
    this.transactionalCalled = true;
    return callback(this);
  }

  public clear(): void {
    this.clearCalled = true;
  }

  public setFilterParams(): void {
    // no-op for tests
  }
}

function createFakeProvider(fakeEm: FakeEntityManager): EntityManagerProvider {
  let currentEm = fakeEm;
  return {
    getEntityManager() {
      return currentEm as unknown as import("@mikro-orm/core").EntityManager;
    },
    setEntityManager(em: import("@mikro-orm/core").EntityManager) {
      currentEm = em as unknown as FakeEntityManager;
    },
    runWithScope<T>(callback: () => Promise<T>): Promise<T> {
      return callback();
    },
  };
}

describe("MikroOrmUnitOfWork", () => {
  it("should begin by initializing the aggregate tracker and forking the EM", async () => {
    const fakeEm = new FakeEntityManager();
    const provider = createFakeProvider(fakeEm);
    const persister = new FakePersister();
    const unitOfWork = new MikroOrmUnitOfWork(provider, [persister]);

    await unitOfWork.begin();

    const currentEm = provider.getEntityManager() as unknown as FakeEntityManager;
    assert.ok(currentEm.forkCalled);
  });

  it("should commit by draining tracked aggregates and persisting inside a transaction", async () => {
    const fakeEm = new FakeEntityManager();
    const provider = createFakeProvider(fakeEm);
    const persister = new FakePersister();
    const unitOfWork = new MikroOrmUnitOfWork(provider, [persister]);

    await unitOfWork.begin();

    const aggregate = FakeAggregate.create(new FakeId("agg-1"), "test");
    AggregateTracker.track(aggregate);

    await unitOfWork.commit();

    assert.equal(persister.persistedAggregates.length, 1);
    assert.equal(persister.persistedAggregates[0], aggregate);

    const currentEm = provider.getEntityManager() as unknown as FakeEntityManager;
    assert.ok(currentEm.transactionalCalled);
  });

  it("should route aggregates marked for deletion to persister.delete", async () => {
    const fakeEm = new FakeEntityManager();
    const provider = createFakeProvider(fakeEm);
    const persister = new FakePersister();
    const unitOfWork = new MikroOrmUnitOfWork(provider, [persister]);

    await unitOfWork.begin();

    const aggregate = FakeAggregate.create(new FakeId("agg-2"), "test");
    aggregate.requestDeletion();
    AggregateTracker.track(aggregate);

    await unitOfWork.commit();

    assert.equal(persister.deletedAggregates.length, 1);
    assert.equal(persister.deletedAggregates[0], aggregate);
    assert.equal(persister.persistedAggregates.length, 0);
  });

  it("should rollback by clearing the tracker and the EM", async () => {
    const fakeEm = new FakeEntityManager();
    const provider = createFakeProvider(fakeEm);
    const persister = new FakePersister();
    const unitOfWork = new MikroOrmUnitOfWork(provider, [persister]);

    await unitOfWork.begin();

    const aggregate = FakeAggregate.create(new FakeId("agg-1"), "test");
    AggregateTracker.track(aggregate);

    await unitOfWork.rollback();

    const drained = AggregateTracker.drain();
    assert.equal(drained.length, 0);

    const currentEm = provider.getEntityManager() as unknown as FakeEntityManager;
    assert.ok(currentEm.clearCalled);
  });
});
