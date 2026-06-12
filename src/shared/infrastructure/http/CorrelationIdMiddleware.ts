import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

interface CorrelationContext {
  readonly correlationId: string;
}

const asyncLocalStorage = new AsyncLocalStorage<CorrelationContext>();

export const CORRELATION_ID_HEADER = "x-correlation-id";

export function getCorrelationId(): string | undefined {
  const store = asyncLocalStorage.getStore();
  if (store === undefined) {
    return undefined;
  }
  return store.correlationId;
}

export function runWithCorrelationId<T>(
  correlationId: string,
  callback: () => Promise<T>,
): Promise<T> {
  return asyncLocalStorage.run({ correlationId }, callback);
}

export function extractOrGenerateCorrelationId(request: IncomingMessage): string {
  const headerValue = request.headers[CORRELATION_ID_HEADER];
  if (typeof headerValue === "string" && headerValue.length > 0) {
    return headerValue;
  }
  return randomUUID();
}
