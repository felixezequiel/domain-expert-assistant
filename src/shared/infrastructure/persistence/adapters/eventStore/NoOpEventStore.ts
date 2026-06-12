import type { DomainEvent } from "../../../../domain/events/DomainEvent.ts";
import type { EventStorePort } from "../../../../ports/EventStorePort.ts";

export class NoOpEventStore implements EventStorePort {
  public async saveAll(_events: ReadonlyArray<DomainEvent>): Promise<void> {
    // no-op — used in tests that do not need event persistence
  }
}
