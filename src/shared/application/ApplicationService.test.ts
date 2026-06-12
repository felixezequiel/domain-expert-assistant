import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ApplicationService } from "./ApplicationService.ts";
import { DomainEventManager } from "./DomainEventManager.ts";
import type { UseCase } from "./UseCase.ts";
import type { EventPublisherPort } from "../ports/EventPublisherPort.ts";
import type { EventStorePort } from "../ports/EventStorePort.ts";
import type { DomainEvent } from "../domain/events/DomainEvent.ts";
import { AggregateRoot } from "../domain/aggregates/AggregateRoot.ts";
import { Identifier } from "../domain/identifiers/Identifier.ts";
import { AggregateTracker } from "../infrastructure/persistence/AggregateTracker.ts";
import { EventEmittingAdapter } from "../infrastructure/adapters/EventEmittingAdapter.ts";
import { TrackedUnitOfWork } from "../infrastructure/persistence/TrackedUnitOfWork.ts";

class FakeId extends Identifier {}

interface FakeProps {
  readonly name: string;
}

class FakeCreatedEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventName = "FakeCreated";
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

class FakeAggregate extends AggregateRoot<FakeId, FakeProps> {
  public static create(id: FakeId, name: string): FakeAggregate {
    const aggregate = new FakeAggregate(id, { name });
    aggregate.addDomainEvent(new FakeCreatedEvent(id.value));
    return aggregate;
  }
}

class FakeUnitOfWork extends TrackedUnitOfWork {
  public onBeginCalled = false;
  public onCommitCalled = false;
  public onRollbackCalled = false;

  protected async onBegin(): Promise<void> {
    this.onBeginCalled = true;
  }

  protected async onCommit(): Promise<void> {
    this.onCommitCalled = true;
  }

  protected async onRollback(): Promise<void> {
    this.onRollbackCalled = true;
  }
}

class FakeEventPublisher implements EventPublisherPort {
  public publishedEvents: Array<DomainEvent> = [];

  public async publish(event: DomainEvent): Promise<void> {
    this.publishedEvents.push(event);
  }

  public async publishAll(events: ReadonlyArray<DomainEvent>): Promise<void> {
    for (const event of events) {
      this.publishedEvents.push(event);
    }
  }
}

class FakeEventStore implements EventStorePort {
  public savedEvents: Array<DomainEvent> = [];
  public shouldFail = false;

  public async saveAll(events: ReadonlyArray<DomainEvent>): Promise<void> {
    if (this.shouldFail) {
      throw new Error("event store failed");
    }
    for (const event of events) {
      this.savedEvents.push(event);
    }
  }
}

interface FakeCommand {
  readonly name: string;
}

class FakeUseCase implements UseCase<FakeCommand, FakeAggregate> {
  public async execute(command: FakeCommand): Promise<FakeAggregate> {
    const aggregate = FakeAggregate.create(new FakeId("agg-1"), command.name);
    return aggregate;
  }
}

class FakeAdapterEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventName = "FakeAdapterEvent";
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

class FakeAdapter extends EventEmittingAdapter {
  public emitEvent(event: DomainEvent): void {
    this.addDomainEvent(event);
  }
}

class FailingUseCase implements UseCase<FakeCommand, FakeAggregate> {
  public async execute(): Promise<FakeAggregate> {
    throw new Error("use case failed");
  }
}

describe("ApplicationService", () => {
  beforeEach(() => {
    AggregateRoot.setOnTrack((aggregate) => {
      AggregateTracker.track(aggregate);
    });
    EventEmittingAdapter.setOnTrack((source) => {
      AggregateTracker.track(source);
    });
  });

  afterEach(() => {
    AggregateRoot.setOnTrack(null);
    EventEmittingAdapter.setOnTrack(null);
  });

  it("should execute the full cycle: begin, useCase, dispatch, publish, commit", async () => {
    const unitOfWork = new FakeUnitOfWork();
    const eventManager = new DomainEventManager();
    const eventPublisher = new FakeEventPublisher();
    const eventStore = new FakeEventStore();
    const useCase = new FakeUseCase();
    const dispatchedEvents: Array<DomainEvent> = [];

    eventManager.register("FakeCreated", async (event) => {
      dispatchedEvents.push(event);
    });

    const applicationService = new ApplicationService(
      unitOfWork,
      eventManager,
      eventPublisher,
      eventStore,
    );

    const result = await applicationService.execute(useCase, { name: "test" });

    assert.ok(unitOfWork.onBeginCalled);
    assert.ok(unitOfWork.onCommitCalled);
    assert.ok(!unitOfWork.onRollbackCalled);
    assert.equal(result.id.value, "agg-1");
    assert.equal(dispatchedEvents.length, 1);
    assert.equal(eventPublisher.publishedEvents.length, 1);
  });

  it("should rollback and re-throw when use case fails", async () => {
    const unitOfWork = new FakeUnitOfWork();
    const eventManager = new DomainEventManager();
    const eventPublisher = new FakeEventPublisher();
    const eventStore = new FakeEventStore();
    const failingUseCase = new FailingUseCase();

    const applicationService = new ApplicationService(
      unitOfWork,
      eventManager,
      eventPublisher,
      eventStore,
    );

    await assert.rejects(() => applicationService.execute(failingUseCase, { name: "test" }), {
      message: "use case failed",
    });

    assert.ok(unitOfWork.onBeginCalled);
    assert.ok(!unitOfWork.onCommitCalled);
    assert.ok(unitOfWork.onRollbackCalled);
  });

  it("should rollback when event dispatch fails", async () => {
    const unitOfWork = new FakeUnitOfWork();
    const eventManager = new DomainEventManager();
    const eventPublisher = new FakeEventPublisher();
    const eventStore = new FakeEventStore();
    const useCase = new FakeUseCase();

    eventManager.register("FakeCreated", async () => {
      throw new Error("handler failed");
    });

    const applicationService = new ApplicationService(
      unitOfWork,
      eventManager,
      eventPublisher,
      eventStore,
    );

    await assert.rejects(() => applicationService.execute(useCase, { name: "test" }), {
      message: "handler failed",
    });

    assert.ok(unitOfWork.onRollbackCalled);
    assert.ok(!unitOfWork.onCommitCalled);
  });

  it("should drain events from all tracked aggregates", async () => {
    const unitOfWork = new FakeUnitOfWork();
    const eventManager = new DomainEventManager();
    const eventPublisher = new FakeEventPublisher();
    const eventStore = new FakeEventStore();

    class MultiAggregateUseCase implements UseCase<FakeCommand, FakeAggregate> {
      public async execute(command: FakeCommand): Promise<FakeAggregate> {
        const firstAggregate = FakeAggregate.create(new FakeId("agg-1"), command.name);
        FakeAggregate.create(new FakeId("agg-2"), command.name);
        return firstAggregate;
      }
    }

    const applicationService = new ApplicationService(
      unitOfWork,
      eventManager,
      eventPublisher,
      eventStore,
    );

    await applicationService.execute(new MultiAggregateUseCase(), { name: "test" });

    assert.equal(eventPublisher.publishedEvents.length, 2);
  });

  it("should persist events via event store before commit", async () => {
    const unitOfWork = new FakeUnitOfWork();
    const eventManager = new DomainEventManager();
    const eventPublisher = new FakeEventPublisher();
    const eventStore = new FakeEventStore();
    const useCase = new FakeUseCase();

    const applicationService = new ApplicationService(
      unitOfWork,
      eventManager,
      eventPublisher,
      eventStore,
    );

    await applicationService.execute(useCase, { name: "test" });

    assert.equal(eventStore.savedEvents.length, 1);
    assert.equal(eventStore.savedEvents[0]!.eventName, "FakeCreated");
    assert.equal(eventStore.savedEvents[0]!.aggregateId, "agg-1");
    assert.ok(unitOfWork.onCommitCalled);
  });

  it("should drain events from both aggregates and adapters", async () => {
    const unitOfWork = new FakeUnitOfWork();
    const eventManager = new DomainEventManager();
    const eventPublisher = new FakeEventPublisher();
    const eventStore = new FakeEventStore();

    const fakeAdapter = new FakeAdapter();

    class UseCaseWithAdapter implements UseCase<FakeCommand, FakeAggregate> {
      public async execute(command: FakeCommand): Promise<FakeAggregate> {
        const aggregate = FakeAggregate.create(new FakeId("agg-1"), command.name);
        fakeAdapter.emitEvent(new FakeAdapterEvent("adapter-1"));
        return aggregate;
      }
    }

    const applicationService = new ApplicationService(
      unitOfWork,
      eventManager,
      eventPublisher,
      eventStore,
    );

    await applicationService.execute(new UseCaseWithAdapter(), { name: "test" });

    assert.equal(eventPublisher.publishedEvents.length, 2);

    const eventNames: Array<string> = [];
    for (const event of eventPublisher.publishedEvents) {
      eventNames.push(event.eventName);
    }
    assert.ok(eventNames.includes("FakeCreated"));
    assert.ok(eventNames.includes("FakeAdapterEvent"));
  });

  it("should rollback when event store fails", async () => {
    const unitOfWork = new FakeUnitOfWork();
    const eventManager = new DomainEventManager();
    const eventPublisher = new FakeEventPublisher();
    const eventStore = new FakeEventStore();
    eventStore.shouldFail = true;
    const useCase = new FakeUseCase();

    const applicationService = new ApplicationService(
      unitOfWork,
      eventManager,
      eventPublisher,
      eventStore,
    );

    await assert.rejects(() => applicationService.execute(useCase, { name: "test" }), {
      message: "event store failed",
    });

    assert.ok(unitOfWork.onRollbackCalled);
    assert.ok(!unitOfWork.onCommitCalled);
  });
});
