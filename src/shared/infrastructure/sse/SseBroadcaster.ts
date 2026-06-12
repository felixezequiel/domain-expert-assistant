import type { DomainEvent } from "../../domain/events/DomainEvent.ts";
import type { SseBroadcasterPort } from "../../ports/SseBroadcasterPort.ts";
import type { SseService } from "./SseService.ts";

export const ADMIN_CHANNEL = "__admin__";
export const ADMIN_EVENT_NAME = "DomainEvent";

export class SseBroadcaster implements SseBroadcasterPort {
  private readonly sseService: SseService;

  constructor(sseService: SseService) {
    this.sseService = sseService;
  }

  public broadcastAll(events: ReadonlyArray<DomainEvent>): void {
    for (const event of events) {
      this.sseService.broadcast(event.aggregateId, event.eventName, event);
      this.sseService.broadcast(ADMIN_CHANNEL, ADMIN_EVENT_NAME, event);
    }
  }
}
