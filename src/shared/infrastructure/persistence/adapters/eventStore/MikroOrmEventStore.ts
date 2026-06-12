import type { EventStorePort } from "../../../../ports/EventStorePort.ts";
import type { DomainEvent } from "../../../../domain/events/DomainEvent.ts";
import type { EntityManagerProvider } from "../EntityManagerProvider.ts";
import { SystemEventEntity } from "./SystemEventEntity.ts";

export class MikroOrmEventStore implements EventStorePort {
  private readonly entityManagerProvider: EntityManagerProvider;

  constructor(entityManagerProvider: EntityManagerProvider) {
    this.entityManagerProvider = entityManagerProvider;
  }

  public async saveAll(events: ReadonlyArray<DomainEvent>): Promise<void> {
    const entityManager = this.entityManagerProvider.getEntityManager();

    for (const event of events) {
      const entity = new SystemEventEntity();
      entity.id = event.eventId;
      entity.eventName = event.eventName;
      entity.aggregateId = event.aggregateId;
      entity.occurredAt = event.occurredAt.toISOString();
      entity.payload = JSON.stringify(event);
      entity.causationId = event.causationId;

      entityManager.persist(entity);
    }
  }
}
