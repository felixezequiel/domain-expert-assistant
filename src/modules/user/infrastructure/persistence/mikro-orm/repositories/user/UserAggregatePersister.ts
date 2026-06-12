import type { EntityManager } from "@mikro-orm/core";
import type { AggregatePersister } from "../../../../../../../shared/infrastructure/persistence/AggregatePersister.ts";
import type { AggregateRoot } from "../../../../../../../shared/domain/aggregates/AggregateRoot.ts";
import type { Identifier } from "../../../../../../../shared/domain/identifiers/Identifier.ts";
import { User } from "../../../../../domain/aggregates/User.ts";
import { UserMapper } from "../../mappers/UserMapper.ts";
import { UserEntity } from "../../entities/UserEntity.ts";

export class UserAggregatePersister implements AggregatePersister {
  public supports(aggregate: AggregateRoot<Identifier, object>): boolean {
    return aggregate instanceof User;
  }

  public async persist(
    aggregate: AggregateRoot<Identifier, object>,
    entityManager: EntityManager,
  ): Promise<void> {
    const user = aggregate as User;
    const ormEntity = UserMapper.toOrmEntity(user);
    await entityManager.upsert(UserEntity, ormEntity);

    for (const addressEntity of ormEntity.addresses) {
      await entityManager.upsert(addressEntity);
    }
  }

  public async delete(
    aggregate: AggregateRoot<Identifier, object>,
    entityManager: EntityManager,
  ): Promise<void> {
    await entityManager.nativeDelete(UserEntity, { id: aggregate.id.value });
  }
}
