import type { DomainEvent } from "../../domain/events/DomainEvent.ts";
import type { SseBroadcasterPort } from "../../ports/SseBroadcasterPort.ts";

export class NoOpSseBroadcaster implements SseBroadcasterPort {
  public broadcastAll(_events: ReadonlyArray<DomainEvent>): void {
    // no-op
  }
}
