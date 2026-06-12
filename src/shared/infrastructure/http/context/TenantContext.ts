import { AsyncLocalStorage } from "node:async_hooks";

interface TenantStore {
  readonly companyId: string;
}

const asyncLocalStorage = new AsyncLocalStorage<TenantStore>();

export function getCurrentCompanyId(): string | null {
  const store = asyncLocalStorage.getStore();
  if (store === undefined) {
    return null;
  }
  return store.companyId;
}

export function runWithTenant<T>(companyId: string, callback: () => Promise<T>): Promise<T> {
  return asyncLocalStorage.run({ companyId }, callback);
}
