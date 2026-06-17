import type { KnowledgeVersionRepositoryPort } from "../../../../application/types.ts";
import type { EntityManagerProvider } from "../../../../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import { getCurrentCompanyId } from "../../../../../../shared/infrastructure/http/context/TenantContext.ts";
import type { KnowledgeVersion } from "../../../../domain/entities/KnowledgeVersion.ts";
import { KnowledgeVersionEntity } from "../entities/KnowledgeVersionEntity.ts";
import { KnowledgeVersionMapper } from "../mappers/KnowledgeVersionMapper.ts";
import { DomainError } from "../../../../../../shared/domain/errors/DomainError.ts";

export class KnowledgeVersionRepository implements KnowledgeVersionRepositoryPort {
  private readonly entityManagerProvider: EntityManagerProvider;

  constructor(entityManagerProvider: EntityManagerProvider) {
    this.entityManagerProvider = entityManagerProvider;
  }

  /**
   * Stages the snapshot without flushing so it commits inside the owning item's unit of
   * work transaction (ADR-012, append-only). The version entity carries the tenant's
   * companyId, resolved from the actor context that scopes the command.
   */
  public async append(version: KnowledgeVersion): Promise<void> {
    const companyId = getCurrentCompanyId();
    if (companyId === null) {
      throw new DomainError(
        "knowledge.missingTenant",
        "validation",
        undefined,
        "Cannot append a knowledge version without a tenant in context",
      );
    }
    const entityManager = this.entityManagerProvider.getEntityManager();
    entityManager.persist(KnowledgeVersionMapper.toOrmEntity(version, companyId));
  }

  public async findByItemAndNumber(
    itemId: string,
    versionNumber: number,
  ): Promise<KnowledgeVersion | null> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entity = await entityManager.findOne(KnowledgeVersionEntity, {
      id: `${itemId}:${versionNumber}`,
    });
    return entity === null ? null : KnowledgeVersionMapper.toDomain(entity);
  }

  public async listByItem(itemId: string): Promise<ReadonlyArray<KnowledgeVersion>> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entities = await entityManager.find(
      KnowledgeVersionEntity,
      { itemId },
      { orderBy: { versionNumber: "asc" } },
    );
    const sorted = [...entities].sort((left, right) => left.versionNumber - right.versionNumber);
    const versions: Array<KnowledgeVersion> = [];
    for (const entity of sorted) {
      versions.push(KnowledgeVersionMapper.toDomain(entity));
    }
    return versions;
  }
}
