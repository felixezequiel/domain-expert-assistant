import type { EventPublisherPort } from "../../ports/EventPublisherPort.ts";
import type { DomainEvent } from "../../domain/events/DomainEvent.ts";
import type { LoggerPort } from "../../ports/LoggerPort.ts";

export class LoggingEventPublisher implements EventPublisherPort {
  private readonly logger: LoggerPort;

  constructor(logger: LoggerPort) {
    this.logger = logger;
  }

  public async publish(event: DomainEvent): Promise<void> {
    this.logger.info("Domain event published: " + event.eventName, {
      aggregateId: event.aggregateId,
      occurredAt: event.occurredAt.toISOString(),
    });
  }

  public async publishAll(events: ReadonlyArray<DomainEvent>): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}
