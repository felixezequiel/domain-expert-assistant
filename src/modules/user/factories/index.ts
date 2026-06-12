import type { EntityManagerProvider } from "../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import type { AggregatePersister } from "../../../shared/infrastructure/persistence/AggregatePersister.ts";
import type { LoggerPort } from "../../../shared/ports/LoggerPort.ts";
import type { InfrastructureResult } from "../../../shared/factories/index.ts";
import { MikroOrmAggregatePersister } from "../../../shared/infrastructure/persistence/adapters/MikroOrmAggregatePersister.ts";
import { MikroOrmUserRepository } from "../infrastructure/persistence/mikro-orm/repositories/user/MikroOrmUserRepository.ts";
import { User } from "../domain/aggregates/User.ts";
import { UserEntity } from "../infrastructure/persistence/mikro-orm/entities/UserEntity.ts";
import { UserMapper } from "../infrastructure/persistence/mikro-orm/mappers/UserMapper.ts";
import { UserModule } from "../bootstrap/UserModule.ts";

export interface UserModuleSetup {
  readonly persisters: ReadonlyArray<AggregatePersister>;
  register(infrastructure: InfrastructureResult, logger: LoggerPort): void;
}

export class UserModuleFactory {
  public static create(entityManagerProvider: EntityManagerProvider): UserModuleSetup {
    const userAggregatePersister = new MikroOrmAggregatePersister({
      aggregateClass: User,
      ormEntityClass: UserEntity,
      toOrmEntity: function mapUserToOrm(user: User): UserEntity {
        return UserMapper.toOrmEntity(user);
      },
      getNestedEntities: function extractAddresses(userEntity: UserEntity): Array<object> {
        return userEntity.addresses;
      },
    });

    const repository = new MikroOrmUserRepository(entityManagerProvider);

    return {
      persisters: [userAggregatePersister],
      register(infrastructure: InfrastructureResult, logger: LoggerPort): void {
        const userModule = new UserModule(infrastructure.applicationService, repository);

        userModule.registerEventHandlers(infrastructure.eventBus, logger);
        userModule.registerRoutes(infrastructure.httpServer);
        userModule.registerResolvers(infrastructure.graphqlServer);
      },
    };
  }
}
