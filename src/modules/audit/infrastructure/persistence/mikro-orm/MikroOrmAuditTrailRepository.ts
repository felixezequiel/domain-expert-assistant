import type { EntityManagerProvider } from "../../../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import { SystemEventEntity } from "../../../../../shared/infrastructure/persistence/adapters/eventStore/SystemEventEntity.ts";
import type {
  AuditEventRecord,
  AuditTrailFilter,
  AuditTrailReadPort,
} from "../../../application/types.ts";

/**
 * Production audit trail read model (PRD-6): a tenant-scoped read over the persisted
 * domain-event store (`system_events`, ADR-008). It owns no write path — auditing is just
 * reading the event stream. Tenant isolation is fail-closed and inescapable: the MikroORM
 * CompanyFilter (set from the actor context in MikroOrmUnitOfWork.onBegin, ADR-009) adds
 * `WHERE company_id = :tenant`, so an auditor only ever sees its own organization's events;
 * privileged events (company_id null) never match the filter. `occurredAt` is stored as an
 * ISO-8601 string, so lexicographic range bounds are chronological.
 */
export class MikroOrmAuditTrailRepository implements AuditTrailReadPort {
  private readonly entityManagerProvider: EntityManagerProvider;

  constructor(entityManagerProvider: EntityManagerProvider) {
    this.entityManagerProvider = entityManagerProvider;
  }

  public async findEvents(filter: AuditTrailFilter): Promise<ReadonlyArray<AuditEventRecord>> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const where = MikroOrmAuditTrailRepository.buildWhere(filter);
    const entities = await entityManager.find(SystemEventEntity, where, {
      orderBy: { occurredAt: "desc" },
      limit: filter.limit,
    });
    return entities.map((entity) => MikroOrmAuditTrailRepository.toRecord(entity));
  }

  private static buildWhere(filter: AuditTrailFilter): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    if (filter.aggregateId !== null) {
      where.aggregateId = filter.aggregateId;
    }
    if (filter.actorId !== null) {
      where.actorId = filter.actorId;
    }
    if (filter.eventName !== null) {
      where.eventName = filter.eventName;
    }
    const occurredAt: Record<string, string> = {};
    if (filter.from !== null) {
      occurredAt.$gte = filter.from.toISOString();
    }
    if (filter.to !== null) {
      occurredAt.$lte = filter.to.toISOString();
    }
    if (Object.keys(occurredAt).length > 0) {
      where.occurredAt = occurredAt;
    }
    return where;
  }

  private static toRecord(entity: SystemEventEntity): AuditEventRecord {
    return {
      eventId: entity.id,
      eventName: entity.eventName,
      aggregateId: entity.aggregateId,
      occurredAt: entity.occurredAt,
      companyId: entity.companyId,
      actorId: entity.actorId,
      actorType: entity.actorType,
      causationId: entity.causationId,
    };
  }
}
