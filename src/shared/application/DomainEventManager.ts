import type { DomainEvent } from "../domain/events/DomainEvent.ts";

type DomainEventHandler = (event: DomainEvent) => Promise<void>;

export class DomainEventManager {
  private handlers: Map<string, Array<DomainEventHandler>> = new Map();

  public register(eventName: string, handler: DomainEventHandler): void {
    const existingHandlers = this.handlers.get(eventName);

    if (existingHandlers === undefined) {
      this.handlers.set(eventName, [handler]);
    } else {
      existingHandlers.push(handler);
    }
  }

  public async dispatch(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventName);

    if (handlers === undefined) {
      return;
    }

    for (const handler of handlers) {
      await handler(event);
    }
  }

  public async dispatchAll(events: ReadonlyArray<DomainEvent>): Promise<void> {
    for (const event of events) {
      await this.dispatch(event);
    }
  }

  public clear(): void {
    this.handlers.clear();
  }
}
