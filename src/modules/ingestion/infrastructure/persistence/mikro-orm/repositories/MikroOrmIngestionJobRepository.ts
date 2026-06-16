import type { IngestionJobRepositoryPort } from "../../../../application/types.ts";
import type { EntityManagerProvider } from "../../../../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import type { IngestionJob } from "../../../../domain/aggregates/IngestionJob.ts";
import type { IngestionJobId } from "../../../../domain/identifiers/IngestionJobId.ts";
import type { IngestionStatus } from "../../../../domain/valueObjects/IngestionStatus.ts";
import { IngestionJobEntity } from "../entities/IngestionJobEntity.ts";
import { IngestionJobMapper } from "../mappers/IngestionJobMapper.ts";

/**
 * Stages writes only — never flushes. The UnitOfWork owns the single flush at commit
 * (ADR-004), so a job's transitions persist atomically with its events.
 */
export class MikroOrmIngestionJobRepository implements IngestionJobRepositoryPort {
  private readonly entityManagerProvider: EntityManagerProvider;

  constructor(entityManagerProvider: EntityManagerProvider) {
    this.entityManagerProvider = entityManagerProvider;
  }

  public async save(job: IngestionJob): Promise<void> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    await entityManager.upsert(IngestionJobEntity, IngestionJobMapper.toOrmEntity(job));
  }

  public async findById(id: IngestionJobId): Promise<IngestionJob | null> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entity = await entityManager.findOne(IngestionJobEntity, { id: id.value });
    return entity === null ? null : IngestionJobMapper.toDomain(entity);
  }

  public async listByStatus(status: IngestionStatus): Promise<ReadonlyArray<IngestionJob>> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entities = await entityManager.find(IngestionJobEntity, { status });
    const jobs: Array<IngestionJob> = [];
    for (const entity of entities) {
      jobs.push(IngestionJobMapper.toDomain(entity));
    }
    return jobs;
  }
}
