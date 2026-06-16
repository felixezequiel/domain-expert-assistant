import type { EntityManager } from "@mikro-orm/core";
import type { EntityManagerProvider } from "../../../../../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";

type EntityRecord = Record<string, unknown> & { id: string };

/**
 * Minimal in-memory fake of the EntityManager slice the Ingestion repository uses
 * (upsert / findOne / find) for co-located repo unit tests, with a generic equality
 * where-matcher. Real MikroORM behaviour is covered by the Postgres integration check.
 */
class FakeEntityManager {
  private readonly store = new Map<string, Map<string, EntityRecord>>();

  public upsert(entityClass: { name: string }, entity: EntityRecord): EntityRecord {
    this.bucket(entityClass).set(entity.id, entity);
    return entity;
  }

  public async findOne(
    entityClass: { name: string },
    where: Record<string, unknown>,
  ): Promise<EntityRecord | null> {
    for (const entity of this.bucket(entityClass).values()) {
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
    for (const entity of this.bucket(entityClass).values()) {
      if (FakeEntityManager.matches(entity, where)) {
        results.push(entity);
      }
    }
    return results;
  }

  private bucket(entityClass: { name: string }): Map<string, EntityRecord> {
    const existing = this.store.get(entityClass.name);
    if (existing !== undefined) {
      return existing;
    }
    const created = new Map<string, EntityRecord>();
    this.store.set(entityClass.name, created);
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
