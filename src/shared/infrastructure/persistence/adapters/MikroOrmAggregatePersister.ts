import type { EntityManager } from "@mikro-orm/core";
import type { AggregatePersister } from "../AggregatePersister.ts";
import type { AggregateRoot } from "../../../domain/aggregates/AggregateRoot.ts";
import type { Identifier } from "../../../domain/identifiers/Identifier.ts";

type AnyAggregate = AggregateRoot<Identifier, object>;

interface MikroOrmAggregatePersisterConfig<
  TAggregate extends AnyAggregate,
  TOrmEntity extends object,
> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly aggregateClass: abstract new (...args: Array<any>) => TAggregate;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly ormEntityClass: new (...args: Array<any>) => TOrmEntity;
  readonly toOrmEntity: (aggregate: TAggregate) => TOrmEntity;
  readonly getNestedEntities?: ((ormEntity: TOrmEntity) => Array<object>) | undefined;
  readonly cleanupNestedEntities?:
    | ((aggregate: TAggregate, entityManager: EntityManager) => Promise<void>)
    | undefined;
  readonly deleteEntity?:
    | ((aggregate: TAggregate, entityManager: EntityManager) => Promise<void>)
    | undefined;
}

function noNestedEntities(): Array<object> {
  return [];
}

export class MikroOrmAggregatePersister<
  TAggregate extends AnyAggregate,
  TOrmEntity extends object,
> implements AggregatePersister {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly aggregateClass: abstract new (...args: Array<any>) => TAggregate;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly ormEntityClass: new (...args: Array<any>) => TOrmEntity;
  private readonly toOrmEntityFn: (aggregate: TAggregate) => TOrmEntity;
  private readonly getNestedEntitiesFn: (ormEntity: TOrmEntity) => Array<object>;
  private readonly cleanupNestedEntitiesFn:
    | ((aggregate: TAggregate, entityManager: EntityManager) => Promise<void>)
    | null;
  private readonly deleteEntityFn:
    | ((aggregate: TAggregate, entityManager: EntityManager) => Promise<void>)
    | null;

  constructor(config: MikroOrmAggregatePersisterConfig<TAggregate, TOrmEntity>) {
    this.aggregateClass = config.aggregateClass;
    this.ormEntityClass = config.ormEntityClass;
    this.toOrmEntityFn = config.toOrmEntity;
    this.cleanupNestedEntitiesFn = config.cleanupNestedEntities ?? null;
    this.deleteEntityFn = config.deleteEntity ?? null;

    if (config.getNestedEntities !== undefined) {
      this.getNestedEntitiesFn = config.getNestedEntities;
    } else {
      this.getNestedEntitiesFn = noNestedEntities;
    }
  }

  public supports(aggregate: AnyAggregate): boolean {
    return aggregate instanceof this.aggregateClass;
  }

  public async persist(aggregate: AnyAggregate, entityManager: EntityManager): Promise<void> {
    const typedAggregate = aggregate as TAggregate;
    const ormEntity = this.toOrmEntityFn(typedAggregate);

    await entityManager.upsert(this.ormEntityClass, ormEntity as never);

    if (this.cleanupNestedEntitiesFn !== null) {
      await this.cleanupNestedEntitiesFn(typedAggregate, entityManager);
    }

    const nestedEntities = this.getNestedEntitiesFn(ormEntity);
    for (const nestedEntity of nestedEntities) {
      await entityManager.upsert(nestedEntity as never);
    }
  }

  public async delete(aggregate: AnyAggregate, entityManager: EntityManager): Promise<void> {
    const typedAggregate = aggregate as TAggregate;
    if (this.deleteEntityFn !== null) {
      await this.deleteEntityFn(typedAggregate, entityManager);
    } else {
      await entityManager.nativeDelete(this.ormEntityClass, { id: aggregate.id.value } as never);
    }
  }
}
