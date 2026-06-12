import type { UserRepositoryPort } from "../../../../../application/port/secondary/UserRepositoryPort.ts";
import type { EntityManagerProvider } from "../../../../../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import type { UserId } from "../../../../../domain/identifiers/UserId.ts";
import type { User } from "../../../../../domain/aggregates/User.ts";
import { UserEntity } from "../../entities/UserEntity.ts";
import { UserMapper } from "../../mappers/UserMapper.ts";

export class MikroOrmUserRepository implements UserRepositoryPort {
  private readonly entityManagerProvider: EntityManagerProvider;

  constructor(entityManagerProvider: EntityManagerProvider) {
    this.entityManagerProvider = entityManagerProvider;
  }

  public async save(user: User): Promise<void> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const ormEntity = UserMapper.toOrmEntity(user);
    entityManager.upsert(UserEntity, ormEntity);

    for (const addressEntity of ormEntity.addresses) {
      entityManager.upsert(addressEntity);
    }

    await entityManager.flush();
  }

  public async findById(id: UserId): Promise<User | null> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entity = await entityManager.findOne(
      UserEntity,
      { id: id.value },
      { populate: ["addresses"] },
    );

    if (entity === null) {
      return null;
    }

    return UserMapper.toDomain(entity);
  }

  public async findByEmail(email: string): Promise<User | null> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entity = await entityManager.findOne(UserEntity, { email }, { populate: ["addresses"] });

    if (entity === null) {
      return null;
    }

    return UserMapper.toDomain(entity);
  }

  public async delete(id: UserId): Promise<void> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    const entity = await entityManager.findOne(UserEntity, { id: id.value });

    if (entity !== null) {
      entityManager.remove(entity);
      await entityManager.flush();
    }
  }
}
