import type { DomainEvent } from "../domain/events/DomainEvent.ts";
import type { DomainEventEmitter } from "../domain/events/DomainEventEmitter.ts";
import type { UseCase } from "./UseCase.ts";
import type { UnitOfWork } from "./UnitOfWork.ts";
import type { DomainEventManager } from "./DomainEventManager.ts";
import type { EventPublisherPort } from "../ports/EventPublisherPort.ts";
import type { EventStorePort } from "../ports/EventStorePort.ts";
import type { SseBroadcasterPort } from "../ports/SseBroadcasterPort.ts";
import { getCurrentActor } from "./context/ActorContext.ts";
import { enrichDomainEvents } from "./events/EventEnricher.ts";

/**
 * Application-layer default so the orchestrator stays free of infrastructure imports
 * (hexagonal dependency rule). Production injects a real SSE broadcaster adapter.
 */
class NoOpSseBroadcaster implements SseBroadcasterPort {
  public broadcastAll(): void {
    // intentionally does nothing
  }
}

export class ApplicationService {
  private readonly unitOfWork: UnitOfWork;
  private readonly domainEventManager: DomainEventManager;
  private readonly eventPublisher: EventPublisherPort;
  private readonly eventStore: EventStorePort;
  private readonly sseBroadcaster: SseBroadcasterPort;
  private readonly scopeWrapper: <T>(fn: () => Promise<T>) => Promise<T>;

  constructor(
    unitOfWork: UnitOfWork,
    domainEventManager: DomainEventManager,
    eventPublisher: EventPublisherPort,
    eventStore: EventStorePort,
    sseBroadcaster: SseBroadcasterPort = new NoOpSseBroadcaster(),
    scopeWrapper: <T>(fn: () => Promise<T>) => Promise<T> = (fn) => fn(),
  ) {
    this.unitOfWork = unitOfWork;
    this.domainEventManager = domainEventManager;
    this.eventPublisher = eventPublisher;
    this.eventStore = eventStore;
    this.sseBroadcaster = sseBroadcaster;
    this.scopeWrapper = scopeWrapper;
  }

  public execute<Command, Result>(
    useCase: UseCase<Command, Result>,
    command: Command,
  ): Promise<Result> {
    return this.scopeWrapper(() => this.executeInScope(useCase, command));
  }

  private async executeInScope<Command, Result>(
    useCase: UseCase<Command, Result>,
    command: Command,
  ): Promise<Result> {
    let allEvents: Array<DomainEvent> = [];
    let result: Result;

    await this.unitOfWork.begin();

    try {
      result = await useCase.execute(command);

      const trackedSources = this.unitOfWork.getTrackedEventSources();
      allEvents = this.drainEventsFromSources(trackedSources);

      enrichDomainEvents(allEvents, getCurrentActor(), this.unitOfWork.getTrackedAggregates());

      await this.domainEventManager.dispatchAll(allEvents);

      await this.eventPublisher.publishAll(allEvents);

      await this.eventStore.saveAll(allEvents);

      await this.unitOfWork.commit();
    } catch (error) {
      await this.unitOfWork.rollback();
      throw error;
    }

    try {
      this.sseBroadcaster.broadcastAll(allEvents);
    } catch {
      // Fire-and-forget: SSE failures must never affect the response
    }

    return result;
  }

  private drainEventsFromSources(sources: ReadonlyArray<DomainEventEmitter>): Array<DomainEvent> {
    const allEvents: Array<DomainEvent> = [];

    for (const source of sources) {
      const events = source.drainDomainEvents();
      for (const event of events) {
        allEvents.push(event);
      }
    }

    return allEvents;
  }
}
