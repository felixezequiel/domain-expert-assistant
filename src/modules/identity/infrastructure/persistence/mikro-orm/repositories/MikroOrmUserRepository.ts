import type { UserRepositoryPort } from "../../../../application/types.ts";
import type { EntityManagerProvider } from "../../../../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import type { User } from "../../../../domain/aggregates/User.ts";
import type { UserId } from "../../../../domain/identifiers/UserId.ts";
import { UserEntity } from "../entities/UserEntity.ts";
import { UserMapper } from "../mappers/UserMapper.ts";

export class MikroOrmUserRepository implements UserRepositoryPort {
  private readonly entityManagerProvider: EntityManagerProvider;

  constructor(entityManagerProvider: EntityManagerProvider) {
    this.entityManagerProvider = entityManagerProvider;
  }

  public async save(user: User): Promise<void> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    await entityManager.upsert(UserEntity, UserMapper.toOrmEntity(user));
  }

  public async findById(id: UserId): Promise<User | null> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entity = await entityManager.findOne(UserEntity, { id: id.value });
    return entity === null ? null : UserMapper.toDomain(entity);
  }

  public async findByEmail(email: string): Promise<User | null> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entity = await entityManager.findOne(UserEntity, { email: email.trim().toLowerCase() });
    return entity === null ? null : UserMapper.toDomain(entity);
  }

  public async existsByEmail(email: string): Promise<boolean> {
    return (await this.findByEmail(email)) !== null;
  }

  public async findByInvitationTokenHash(tokenHash: string): Promise<User | null> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entity = await entityManager.findOne(UserEntity, { invitationTokenHash: tokenHash });
    return entity === null ? null : UserMapper.toDomain(entity);
  }

  public async countActiveAdmins(companyId: string): Promise<number> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entities = await entityManager.find(UserEntity, { companyId, status: "active" });
    let count = 0;
    for (const entity of entities) {
      if (entity.roles.split(",").includes("admin")) {
        count += 1;
      }
    }
    return count;
  }

  public async listByCompany(companyId: string): Promise<ReadonlyArray<User>> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entities = await entityManager.find(UserEntity, { companyId });
    return entities.map((entity) => UserMapper.toDomain(entity));
  }
}
