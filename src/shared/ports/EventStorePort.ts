import type { DomainEvent } from "../domain/events/DomainEvent.ts";

export interface EventStorePort {
  saveAll(events: ReadonlyArray<DomainEvent>): Promise<void>;
}
