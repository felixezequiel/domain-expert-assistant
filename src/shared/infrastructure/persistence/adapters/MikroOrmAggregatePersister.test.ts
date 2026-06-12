import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MikroOrmAggregatePersister } from "./MikroOrmAggregatePersister.ts";
import { AggregateRoot } from "../../../domain/aggregates/AggregateRoot.ts";
import { Identifier } from "../../../domain/identifiers/Identifier.ts";
import type { EntityManager } from "@mikro-orm/core";

// --- Test doubles ---

class TestAggregateId extends Identifier {}

class TestAggregate extends AggregateRoot<TestAggregateId, { readonly value: string }> {
  public get value(): string {
    return this.props.value;
  }

  public static create(id: TestAggregateId, value: string): TestAggregate {
    return new TestAggregate(id, { value });
  }
}

class OtherAggregate extends AggregateRoot<Identifier, { readonly data: string }> {}

class TestOrmEntity {
  public id!: string;
  public value!: string;
}

class TestNestedOrmEntity {
  public id!: string;
  public parentId!: string;
}

interface UpsertCall {
  readonly entityClass: unknown;
  readonly data: unknown;
}

interface DeleteCall {
  readonly entityClass: unknown;
  readonly where: unknown;
}

function createFakeEntityManager(): {
  entityManager: EntityManager;
  upsertCalls: Array<UpsertCall>;
  deleteCalls: Array<DeleteCall>;
} {
  const upsertCalls: Array<UpsertCall> = [];
  const deleteCalls: Array<DeleteCall> = [];

  const entityManager = {
    async upsert(entityClassOrData: unknown, data?: unknown): Promise<void> {
      if (data !== undefined) {
        upsertCalls.push({ entityClass: entityClassOrData, data });
      } else {
        upsertCalls.push({ entityClass: null, data: entityClassOrData });
      }
    },
    async nativeDelete(entityClass: unknown, where: unknown): Promise<number> {
      deleteCalls.push({ entityClass, where });
      return 1;
    },
  } as unknown as EntityManager;

  return { entityManager, upsertCalls, deleteCalls };
}

function createTestMapper(aggregate: TestAggregate): TestOrmEntity {
  const entity = new TestOrmEntity();
  entity.id = aggregate.id.value;
  entity.value = aggregate.value;
  return entity;
}

// --- Tests ---

describe("MikroOrmAggregatePersister", () => {
  it("should support aggregates of the configured class", () => {
    const persister = new MikroOrmAggregatePersister({
      aggregateClass: TestAggregate,
      ormEntityClass: TestOrmEntity,
      toOrmEntity: createTestMapper,
    });

    const aggregate = TestAggregate.create(new TestAggregateId("test-1"), "hello");

    assert.ok(persister.supports(aggregate));
  });

  it("should not support aggregates of a different class", () => {
    const persister = new MikroOrmAggregatePersister({
      aggregateClass: TestAggregate,
      ormEntityClass: TestOrmEntity,
      toOrmEntity: createTestMapper,
    });

    const otherAggregate = new OtherAggregate(new Identifier("other-1"), { data: "other" });

    assert.ok(!persister.supports(otherAggregate));
  });

  it("should persist only the root entity when no nested entities are configured", async () => {
    const fakeEntityManager = createFakeEntityManager();

    const persister = new MikroOrmAggregatePersister({
      aggregateClass: TestAggregate,
      ormEntityClass: TestOrmEntity,
      toOrmEntity: createTestMapper,
    });

    const aggregate = TestAggregate.create(new TestAggregateId("test-1"), "hello");
    await persister.persist(aggregate, fakeEntityManager.entityManager);

    const EXPECTED_UPSERT_COUNT = 1;
    assert.equal(fakeEntityManager.upsertCalls.length, EXPECTED_UPSERT_COUNT);

    const rootUpsertCall = fakeEntityManager.upsertCalls[0]!;
    assert.equal(rootUpsertCall.entityClass, TestOrmEntity);

    const persistedEntity = rootUpsertCall.data as TestOrmEntity;
    assert.equal(persistedEntity.id, "test-1");
    assert.equal(persistedEntity.value, "hello");
  });

  it("should persist root entity and nested entities when getNestedEntities is provided", async () => {
    const fakeEntityManager = createFakeEntityManager();

    const nestedEntity1 = new TestNestedOrmEntity();
    nestedEntity1.id = "nested-1";
    nestedEntity1.parentId = "test-1";

    const nestedEntity2 = new TestNestedOrmEntity();
    nestedEntity2.id = "nested-2";
    nestedEntity2.parentId = "test-1";

    const persister = new MikroOrmAggregatePersister({
      aggregateClass: TestAggregate,
      ormEntityClass: TestOrmEntity,
      toOrmEntity: createTestMapper,
      getNestedEntities: function extractNestedEntities(): Array<object> {
        return [nestedEntity1, nestedEntity2];
      },
    });

    const aggregate = TestAggregate.create(new TestAggregateId("test-1"), "hello");
    await persister.persist(aggregate, fakeEntityManager.entityManager);

    const ROOT_UPSERT_COUNT = 1;
    const NESTED_UPSERT_COUNT = 2;
    const EXPECTED_TOTAL_UPSERTS = ROOT_UPSERT_COUNT + NESTED_UPSERT_COUNT;
    assert.equal(fakeEntityManager.upsertCalls.length, EXPECTED_TOTAL_UPSERTS);

    const rootUpsertCall = fakeEntityManager.upsertCalls[0]!;
    assert.equal(rootUpsertCall.entityClass, TestOrmEntity);

    const firstNestedUpsertCall = fakeEntityManager.upsertCalls[1]!;
    assert.equal(firstNestedUpsertCall.entityClass, null);
    assert.equal(firstNestedUpsertCall.data, nestedEntity1);

    const secondNestedUpsertCall = fakeEntityManager.upsertCalls[2]!;
    assert.equal(secondNestedUpsertCall.entityClass, null);
    assert.equal(secondNestedUpsertCall.data, nestedEntity2);
  });

  it("should run cleanupNestedEntities before re-upserting nested entities", async () => {
    const fakeEntityManager = createFakeEntityManager();
    const cleanupCalls: Array<TestAggregate> = [];

    const nestedEntity = new TestNestedOrmEntity();
    nestedEntity.id = "nested-1";
    nestedEntity.parentId = "test-1";

    const persister = new MikroOrmAggregatePersister({
      aggregateClass: TestAggregate,
      ormEntityClass: TestOrmEntity,
      toOrmEntity: createTestMapper,
      getNestedEntities: () => [nestedEntity],
      cleanupNestedEntities: async (aggregate) => {
        cleanupCalls.push(aggregate);
      },
    });

    const aggregate = TestAggregate.create(new TestAggregateId("test-1"), "hello");
    await persister.persist(aggregate, fakeEntityManager.entityManager);

    assert.equal(cleanupCalls.length, 1);
    assert.equal(cleanupCalls[0], aggregate);
  });

  it("should call nativeDelete on root entity when no deleteEntity is configured", async () => {
    const fakeEntityManager = createFakeEntityManager();

    const persister = new MikroOrmAggregatePersister({
      aggregateClass: TestAggregate,
      ormEntityClass: TestOrmEntity,
      toOrmEntity: createTestMapper,
    });

    const aggregate = TestAggregate.create(new TestAggregateId("test-1"), "hello");
    await persister.delete(aggregate, fakeEntityManager.entityManager);

    assert.equal(fakeEntityManager.deleteCalls.length, 1);
    const deleteCall = fakeEntityManager.deleteCalls[0]!;
    assert.equal(deleteCall.entityClass, TestOrmEntity);
    assert.deepEqual(deleteCall.where, { id: "test-1" });
  });

  it("should delegate to deleteEntity when configured", async () => {
    const fakeEntityManager = createFakeEntityManager();
    const customDeleteCalls: Array<TestAggregate> = [];

    const persister = new MikroOrmAggregatePersister({
      aggregateClass: TestAggregate,
      ormEntityClass: TestOrmEntity,
      toOrmEntity: createTestMapper,
      deleteEntity: async (aggregate) => {
        customDeleteCalls.push(aggregate);
      },
    });

    const aggregate = TestAggregate.create(new TestAggregateId("test-1"), "hello");
    await persister.delete(aggregate, fakeEntityManager.entityManager);

    assert.equal(customDeleteCalls.length, 1);
    assert.equal(customDeleteCalls[0], aggregate);
    assert.equal(fakeEntityManager.deleteCalls.length, 0);
  });
});
