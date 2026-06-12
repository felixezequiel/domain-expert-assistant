import { AsyncLocalStorage } from "node:async_hooks";
import type { DomainEventEmitter } from "../../domain/events/DomainEventEmitter.ts";

type TrackedSet = Set<DomainEventEmitter>;
type TrackedStack = Array<TrackedSet>;

const asyncLocalStorage = new AsyncLocalStorage<TrackedStack>();

export class AggregateTracker {
  public static run<T>(callback: () => Promise<T>): Promise<T> {
    return asyncLocalStorage.run([], callback);
  }

  public static begin(): void {
    let stack = asyncLocalStorage.getStore();
    if (stack === undefined) {
      stack = [];
      asyncLocalStorage.enterWith(stack);
    }
    stack.push(new Set());
  }

  public static track(source: DomainEventEmitter): void {
    const stack = asyncLocalStorage.getStore();
    if (stack === undefined || stack.length === 0) {
      return;
    }
    const currentScope = stack[stack.length - 1]!;
    currentScope.add(source);
  }

  public static drain(): Array<DomainEventEmitter> {
    const stack = asyncLocalStorage.getStore();
    if (stack === undefined || stack.length === 0) {
      return [];
    }
    const currentScope = stack.pop()!;
    return Array.from(currentScope);
  }

  public static peek(): Array<DomainEventEmitter> {
    const stack = asyncLocalStorage.getStore();
    if (stack === undefined || stack.length === 0) {
      return [];
    }
    const currentScope = stack[stack.length - 1]!;
    return Array.from(currentScope);
  }

  public static clear(): void {
    const stack = asyncLocalStorage.getStore();
    if (stack === undefined || stack.length === 0) {
      return;
    }
    stack.pop();
  }
}
