import { BaseDomainEvent } from "../../../../shared/domain/events/BaseDomainEvent.ts";

/**
 * IngestionJob lifecycle events (PRD-3). Grouped since they share the aggregate and are
 * emitted by its guarded transition methods.
 */
export class DocumentUploadedEvent extends BaseDomainEvent {
  public readonly eventName = "DocumentUploaded";
  constructor(
    aggregateId: string,
    public readonly filename: string,
    public readonly mimeType: string,
    causationId: string | null = null,
  ) {
    super(aggregateId, causationId);
  }
}

export class IngestionStartedEvent extends BaseDomainEvent {
  public readonly eventName = "IngestionStarted";
  constructor(aggregateId: string, causationId: string | null = null) {
    super(aggregateId, causationId);
  }
}

export class IngestionCompletedEvent extends BaseDomainEvent {
  public readonly eventName = "IngestionCompleted";
  constructor(aggregateId: string, public readonly createdItemId: string, causationId: string | null = null) {
    super(aggregateId, causationId);
  }
}

export class IngestionFailedEvent extends BaseDomainEvent {
  public readonly eventName = "IngestionFailed";
  constructor(aggregateId: string, public readonly reason: string, causationId: string | null = null) {
    super(aggregateId, causationId);
  }
}

/** Emitted by stuck-job recovery (ADR-015): a job left `processing` is returned to the queue. */
export class IngestionRequeuedEvent extends BaseDomainEvent {
  public readonly eventName = "IngestionRequeued";
  constructor(aggregateId: string, causationId: string | null = null) {
    super(aggregateId, causationId);
  }
}
