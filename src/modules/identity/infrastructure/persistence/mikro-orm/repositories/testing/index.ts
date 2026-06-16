import type { EntityManager } from "@mikro-orm/core";
import type { EntityManagerProvider } from "../../../../../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";

type EntityRecord = Record<string, unknown> & { id: string };

/**
 * Minimal in-memory fake of the slice of EntityManager the Identity repositories use
 * (upsert / persist / findOne / find / nativeUpdate / flush) plus a generic equality
 * where-matcher. `persist` stages without committing — the insert-only Session write that the
 * UnitOfWork flushes at commit (ADR-004); staged records are visible to reads and `nativeUpdate`,
 * and `flush` promotes them. Lets the repository unit tests verify delegation + mapping without a
 * live database; the real MikroORM behaviour (and tenant filtering) is covered by the Postgres
 * integration test.
 */
class FakeEntityManager {
  private readonly store = new Map<string, Map<string, EntityRecord>>();
  private readonly staged = new Map<string, Map<string, EntityRecord>>();

  public upsert(entityClass: { name: string }, entity: EntityRecord): EntityRecord {
    this.bucket(this.store, entityClass).set(entity.id, entity);
    return entity;
  }

  public persist(entity: EntityRecord): void {
    this.bucketByName(this.staged, entity.constructor.name).set(entity.id, entity);
  }

  public async flush(): Promise<void> {
    for (const [bucketName, records] of this.staged) {
      const target = this.bucketByName(this.store, bucketName);
      for (const [key, value] of records) {
        target.set(key, value);
      }
    }
    this.staged.clear();
  }

  public async findOne(
    entityClass: { name: string },
    where: Record<string, unknown>,
  ): Promise<EntityRecord | null> {
    for (const entity of this.visible(entityClass)) {
      if (FakeEntityManager.matches(entity, where)) {
        return entity;
      }
    }
    return null;
  }

  public async find(
    entityClass: { name: string },
    where: Record<string, unknown>,
  ): Promise<Array<EntityRecord>> {
    const results: Array<EntityRecord> = [];
    for (const entity of this.visible(entityClass)) {
      if (FakeEntityManager.matches(entity, where)) {
        results.push(entity);
      }
    }
    return results;
  }

  public async nativeUpdate(
    entityClass: { name: string },
    where: Record<string, unknown>,
    data: Record<string, unknown>,
  ): Promise<number> {
    let affected = 0;
    for (const entity of this.visible(entityClass)) {
      if (FakeEntityManager.matches(entity, where)) {
        Object.assign(entity, data);
        affected += 1;
      }
    }
    return affected;
  }

  private visible(entityClass: { name: string }): Array<EntityRecord> {
    const committed = this.bucket(this.store, entityClass);
    const pending = this.bucket(this.staged, entityClass);
    return [...committed.values(), ...pending.values()];
  }

  private bucket(
    root: Map<string, Map<string, EntityRecord>>,
    entityClass: { name: string },
  ): Map<string, EntityRecord> {
    return this.bucketByName(root, entityClass.name);
  }

  private bucketByName(
    root: Map<string, Map<string, EntityRecord>>,
    name: string,
  ): Map<string, EntityRecord> {
    const existing = root.get(name);
    if (existing !== undefined) {
      return existing;
    }
    const created = new Map<string, EntityRecord>();
    root.set(name, created);
    return created;
  }

  private static matches(entity: EntityRecord, where: Record<string, unknown>): boolean {
    for (const key of Object.keys(where)) {
      if (entity[key] !== where[key]) {
        return false;
      }
    }
    return true;
  }
}

export function createFakeEntityManagerProvider(): EntityManagerProvider {
  const entityManager = new FakeEntityManager();
  return {
    getEntityManager(): EntityManager {
      return entityManager as unknown as EntityManager;
    },
    setEntityManager(): void {
      // single fixed EM in tests
    },
    runWithScope<T>(callback: () => Promise<T>): Promise<T> {
      return callback();
    },
  };
}
