import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { InMemoryUnitOfWork } from "./InMemoryUnitOfWork.ts";
import { AggregateTracker } from "../AggregateTracker.ts";
import { AggregateRoot } from "../../../domain/aggregates/AggregateRoot.ts";
import { Identifier } from "../../../domain/identifiers/Identifier.ts";
import type { DomainEvent } from "../../../domain/events/DomainEvent.ts";
import type { RepositoryPort } from "../../../ports/RepositoryPort.ts";

class FakeId extends Identifier {}

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

class FakeAggregate extends AggregateRoot<FakeId, FakeProps> {
  public static create(id: FakeId, name: string): FakeAggregate {
    const aggregate = new FakeAggregate(id, { name });
    aggregate.addDomainEvent(new FakeCreatedEvent(id.value));
    return aggregate;
  }
}

class FakeRepository implements RepositoryPort<FakeId, FakeAggregate> {
  public savedAggregates: Array<FakeAggregate> = [];

  public async save(aggregate: FakeAggregate): Promise<void> {
    this.savedAggregates.push(aggregate);
  }

  public async findById(): Promise<FakeAggregate | null> {
    return null;
  }

  public async delete(): Promise<void> {}
}

describe("InMemoryUnitOfWork", () => {
  it("should begin by initializing the aggregate tracker", async () => {
    const repository = new FakeRepository();
    const unitOfWork = new InMemoryUnitOfWork([
      {
        supports: () => true,
        save: (aggregate: AggregateRoot<Identifier, object>) =>
          repository.save(aggregate as FakeAggregate),
      },
    ]);

    await unitOfWork.begin();

    const aggregate = FakeAggregate.create(new FakeId("agg-1"), "test");
    AggregateTracker.track(aggregate);

    const drained = AggregateTracker.drain();
    assert.equal(drained.length, 1);
  });

  it("should commit by draining tracked aggregates and saving to repositories", async () => {
    const repository = new FakeRepository();
    const unitOfWork = new InMemoryUnitOfWork([
      {
        supports: () => true,
        save: (aggregate: AggregateRoot<Identifier, object>) =>
          repository.save(aggregate as FakeAggregate),
      },
    ]);

    await unitOfWork.begin();

    const aggregate = FakeAggregate.create(new FakeId("agg-1"), "test");
    AggregateTracker.track(aggregate);

    await unitOfWork.commit();

    assert.equal(repository.savedAggregates.length, 1);
    assert.equal(repository.savedAggregates[0], aggregate);
  });

  it("should rollback by clearing the tracker", async () => {
    const repository = new FakeRepository();
    const unitOfWork = new InMemoryUnitOfWork([
      {
        supports: () => true,
        save: (aggregate: AggregateRoot<Identifier, object>) =>
          repository.save(aggregate as FakeAggregate),
      },
    ]);

    await unitOfWork.begin();

    const aggregate = FakeAggregate.create(new FakeId("agg-1"), "test");
    AggregateTracker.track(aggregate);

    await unitOfWork.rollback();

    assert.equal(repository.savedAggregates.length, 0);
    const drained = AggregateTracker.drain();
    assert.equal(drained.length, 0);
  });
});
