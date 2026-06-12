import type { DomainEvent } from "../domain/events/DomainEvent.ts";

export interface EventPublisherPort {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: ReadonlyArray<DomainEvent>): Promise<void>;
}
