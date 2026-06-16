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
import { runWithActor, type Actor } from "../../../application/context/ActorContext.ts";

// The UoW is fail-closed (ADR-009): begin() requires a tenant or privileged scope.
// These mechanics tests exercise fork/transaction/commit/rollback under a privileged system scope.
const SYSTEM_SCOPE: Actor = { companyId: null, actorId: "system", actorType: "system" };

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
  public beginCalled = false;
  public beginReadOnly: boolean | undefined = undefined;
  public flushCalled = false;
  public commitCalled = false;
  public rollbackCalled = false;
  public clearCalled = false;
  private inTransaction = false;

  public fork(): FakeEntityManager {
    const forked = new FakeEntityManager();
    forked.forkCalled = true;
    return forked;
  }

  public async begin(options?: { readOnly?: boolean }): Promise<void> {
    this.beginCalled = true;
    this.beginReadOnly = options?.readOnly ?? false;
    this.inTransaction = true;
  }

  public async flush(): Promise<void> {
    this.flushCalled = true;
  }

  public async commit(): Promise<void> {
    this.commitCalled = true;
    this.inTransaction = false;
  }

  public async rollback(): Promise<void> {
    this.rollbackCalled = true;
    this.inTransaction = false;
  }

  public isInTransaction(): boolean {
    return this.inTransaction;
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
  it("should begin by forking the EM and opening a read-write transaction", async () => {
    const fakeEm = new FakeEntityManager();
    const provider = createFakeProvider(fakeEm);
    const persister = new FakePersister();
    const unitOfWork = new MikroOrmUnitOfWork(provider, [persister]);

    await runWithActor(SYSTEM_SCOPE, () => unitOfWork.begin());

    const currentEm = provider.getEntityManager() as unknown as FakeEntityManager;
    assert.ok(currentEm.forkCalled);
    assert.ok(currentEm.beginCalled);
    assert.equal(currentEm.beginReadOnly, false);
  });

  it("should open a READ ONLY transaction when begin is asked to", async () => {
    const fakeEm = new FakeEntityManager();
    const provider = createFakeProvider(fakeEm);
    const persister = new FakePersister();
    const unitOfWork = new MikroOrmUnitOfWork(provider, [persister]);

    await runWithActor(SYSTEM_SCOPE, () => unitOfWork.begin(true));

    const currentEm = provider.getEntityManager() as unknown as FakeEntityManager;
    assert.equal(currentEm.beginReadOnly, true);
  });

  it("should commit by draining tracked aggregates, then flushing and committing", async () => {
    const fakeEm = new FakeEntityManager();
    const provider = createFakeProvider(fakeEm);
    const persister = new FakePersister();
    const unitOfWork = new MikroOrmUnitOfWork(provider, [persister]);

    await runWithActor(SYSTEM_SCOPE, () => unitOfWork.begin());

    const aggregate = FakeAggregate.create(new FakeId("agg-1"), "test");
    AggregateTracker.track(aggregate);

    await unitOfWork.commit();

    assert.equal(persister.persistedAggregates.length, 1);
    assert.equal(persister.persistedAggregates[0], aggregate);

    const currentEm = provider.getEntityManager() as unknown as FakeEntityManager;
    assert.ok(currentEm.flushCalled);
    assert.ok(currentEm.commitCalled);
  });

  it("should route aggregates marked for deletion to persister.delete", async () => {
    const fakeEm = new FakeEntityManager();
    const provider = createFakeProvider(fakeEm);
    const persister = new FakePersister();
    const unitOfWork = new MikroOrmUnitOfWork(provider, [persister]);

    await runWithActor(SYSTEM_SCOPE, () => unitOfWork.begin());

    const aggregate = FakeAggregate.create(new FakeId("agg-2"), "test");
    aggregate.requestDeletion();
    AggregateTracker.track(aggregate);

    await unitOfWork.commit();

    assert.equal(persister.deletedAggregates.length, 1);
    assert.equal(persister.deletedAggregates[0], aggregate);
    assert.equal(persister.persistedAggregates.length, 0);
  });

  it("should rollback by clearing the tracker and rolling back the transaction", async () => {
    const fakeEm = new FakeEntityManager();
    const provider = createFakeProvider(fakeEm);
    const persister = new FakePersister();
    const unitOfWork = new MikroOrmUnitOfWork(provider, [persister]);

    await runWithActor(SYSTEM_SCOPE, () => unitOfWork.begin());

    const aggregate = FakeAggregate.create(new FakeId("agg-1"), "test");
    AggregateTracker.track(aggregate);

    await unitOfWork.rollback();

    const drained = AggregateTracker.drain();
    assert.equal(drained.length, 0);

    const currentEm = provider.getEntityManager() as unknown as FakeEntityManager;
    assert.ok(currentEm.rollbackCalled);
    assert.ok(currentEm.clearCalled);
  });
});
