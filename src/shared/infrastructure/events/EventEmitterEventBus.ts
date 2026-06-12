import { EventEmitter } from "node:events";
import type { DomainEvent } from "../../domain/events/DomainEvent.ts";
import type { EventPublisherPort } from "../../ports/EventPublisherPort.ts";

type EventSubscriber = (event: DomainEvent) => Promise<void>;

export class EventEmitterEventBus implements EventPublisherPort {
  private readonly emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
  }

  public subscribe(eventName: string, subscriber: EventSubscriber): void {
    this.emitter.on(eventName, subscriber);
  }

  public async publish(event: DomainEvent): Promise<void> {
    const subscribers = this.emitter.listeners(event.eventName) as Array<EventSubscriber>;

    for (const subscriber of subscribers) {
      await subscriber(event);
    }
  }

  public async publishAll(events: ReadonlyArray<DomainEvent>): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  public subscriberCount(eventName: string): number {
    return this.emitter.listenerCount(eventName);
  }
}
