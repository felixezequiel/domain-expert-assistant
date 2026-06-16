import type { ConsumerCredentialRepositoryPort } from "../../../../application/types.ts";
import type { EntityManagerProvider } from "../../../../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import type { ConsumerCredential } from "../../../../domain/aggregates/ConsumerCredential.ts";
import type { CredentialId } from "../../../../domain/identifiers/CredentialId.ts";
import { ConsumerCredentialEntity } from "../entities/ConsumerCredentialEntity.ts";
import { ConsumerCredentialMapper } from "../mappers/ConsumerCredentialMapper.ts";

export class MikroOrmConsumerCredentialRepository implements ConsumerCredentialRepositoryPort {
  private readonly entityManagerProvider: EntityManagerProvider;

  constructor(entityManagerProvider: EntityManagerProvider) {
    this.entityManagerProvider = entityManagerProvider;
  }

  public async save(credential: ConsumerCredential): Promise<void> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    await entityManager.upsert(
      ConsumerCredentialEntity,
      ConsumerCredentialMapper.toOrmEntity(credential),
    );
  }

  public async findById(id: CredentialId): Promise<ConsumerCredential | null> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entity = await entityManager.findOne(ConsumerCredentialEntity, { id: id.value });
    return entity === null ? null : ConsumerCredentialMapper.toDomain(entity);
  }

  public async findBySecretHash(secretHash: string): Promise<ConsumerCredential | null> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entity = await entityManager.findOne(ConsumerCredentialEntity, { secretHash });
    return entity === null ? null : ConsumerCredentialMapper.toDomain(entity);
  }

  public async listByCompany(companyId: string): Promise<ReadonlyArray<ConsumerCredential>> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entities = await entityManager.find(ConsumerCredentialEntity, { companyId });
    const credentials: Array<ConsumerCredential> = [];
    for (const entity of entities) {
      credentials.push(ConsumerCredentialMapper.toDomain(entity));
    }
    return credentials;
  }
}
