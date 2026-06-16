import type { OrganizationRepositoryPort } from "../../../../application/types.ts";
import type { EntityManagerProvider } from "../../../../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import type { Organization } from "../../../../domain/aggregates/Organization.ts";
import type { OrganizationId } from "../../../../domain/identifiers/OrganizationId.ts";
import { OrganizationEntity } from "../entities/OrganizationEntity.ts";
import { OrganizationMapper } from "../mappers/OrganizationMapper.ts";

export class MikroOrmOrganizationRepository implements OrganizationRepositoryPort {
  private readonly entityManagerProvider: EntityManagerProvider;

  constructor(entityManagerProvider: EntityManagerProvider) {
    this.entityManagerProvider = entityManagerProvider;
  }

  public async save(organization: Organization): Promise<void> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    await entityManager.upsert(OrganizationEntity, OrganizationMapper.toOrmEntity(organization));
    await entityManager.flush();
  }

  public async findById(id: OrganizationId): Promise<Organization | null> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entity = await entityManager.findOne(OrganizationEntity, { id: id.value });
    return entity === null ? null : OrganizationMapper.toDomain(entity);
  }

  public async existsByName(name: string): Promise<boolean> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    return (await entityManager.findOne(OrganizationEntity, { name })) !== null;
  }
}
