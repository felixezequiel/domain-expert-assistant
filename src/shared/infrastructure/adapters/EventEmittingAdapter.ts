import type { DomainEvent } from "../../domain/events/DomainEvent.ts";
import type { DomainEventEmitter } from "../../domain/events/DomainEventEmitter.ts";

type OnTrackCallback = (source: DomainEventEmitter) => void;

export abstract class EventEmittingAdapter implements DomainEventEmitter {
  private static onTrackCallback: OnTrackCallback | null = null;

  private domainEvents: Array<DomainEvent> = [];
  private tracked = false;

  public static setOnTrack(callback: OnTrackCallback | null): void {
    EventEmittingAdapter.onTrackCallback = callback;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);

    if (!this.tracked && EventEmittingAdapter.onTrackCallback !== null) {
      this.tracked = true;
      EventEmittingAdapter.onTrackCallback(this);
    }
  }

  public getDomainEvents(): ReadonlyArray<DomainEvent> {
    return [...this.domainEvents];
  }

  public drainDomainEvents(): ReadonlyArray<DomainEvent> {
    const events = [...this.domainEvents];
    this.domainEvents = [];
    this.tracked = false;
    return events;
  }
}
