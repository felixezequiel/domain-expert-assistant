import type { DomainEvent } from "../domain/events/DomainEvent.ts";

export interface SseBroadcasterPort {
  broadcastAll(events: ReadonlyArray<DomainEvent>): void;
}
