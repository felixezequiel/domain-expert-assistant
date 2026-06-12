import { AsyncLocalStorage } from "node:async_hooks";
import type { EntityManager } from "@mikro-orm/core";

interface EmStore {
  em: EntityManager;
}

export interface EntityManagerProvider {
  getEntityManager(): EntityManager;
  setEntityManager(entityManager: EntityManager): void;
  runWithScope<T>(callback: () => Promise<T>): Promise<T>;
}

export class MikroOrmEntityManagerProvider implements EntityManagerProvider {
  private readonly rootEntityManager: EntityManager;
  private readonly als = new AsyncLocalStorage<EmStore>();

  constructor(entityManager: EntityManager) {
    this.rootEntityManager = entityManager;
  }

  public getEntityManager(): EntityManager {
    return this.als.getStore()?.em ?? this.rootEntityManager.fork();
  }

  public setEntityManager(entityManager: EntityManager): void {
    const store = this.als.getStore();
    if (store !== undefined) {
      store.em = entityManager;
    }
  }

  public runWithScope<T>(callback: () => Promise<T>): Promise<T> {
    return this.als.run({ em: this.rootEntityManager }, callback);
  }
}
