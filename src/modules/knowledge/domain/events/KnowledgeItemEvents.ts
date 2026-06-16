import { BaseDomainEvent } from "../../../../shared/domain/events/BaseDomainEvent.ts";

/**
 * KnowledgeItem lifecycle events (PRD-2). Grouped in one file because they share the
 * aggregate and are emitted by its guarded transition methods. `Published`, `Deprecated`
 * and `Archived` are the triggers the indexing context (PRD-4) consumes; the content
 * events carry the version number created by that change (ADR-012).
 */
export class KnowledgeItemDraftedEvent extends BaseDomainEvent {
  public readonly eventName = "KnowledgeItemDrafted";
  constructor(
    aggregateId: string,
    public readonly title: string,
    public readonly collectionId: string,
    public readonly versionNumber: number,
    causationId: string | null = null,
  ) {
    super(aggregateId, causationId);
  }
}

export class KnowledgeItemEditedEvent extends BaseDomainEvent {
  public readonly eventName = "KnowledgeItemEdited";
  constructor(aggregateId: string, public readonly versionNumber: number, causationId: string | null = null) {
    super(aggregateId, causationId);
  }
}

export class KnowledgeItemRetaggedEvent extends BaseDomainEvent {
  public readonly eventName = "KnowledgeItemRetagged";
  constructor(aggregateId: string, public readonly versionNumber: number, causationId: string | null = null) {
    super(aggregateId, causationId);
  }
}

export class KnowledgeItemMovedToCollectionEvent extends BaseDomainEvent {
  public readonly eventName = "KnowledgeItemMovedToCollection";
  constructor(aggregateId: string, public readonly collectionId: string, causationId: string | null = null) {
    super(aggregateId, causationId);
  }
}

export class KnowledgeItemSubmittedForReviewEvent extends BaseDomainEvent {
  public readonly eventName = "KnowledgeItemSubmittedForReview";
  constructor(aggregateId: string, causationId: string | null = null) {
    super(aggregateId, causationId);
  }
}

export class KnowledgeItemRejectedEvent extends BaseDomainEvent {
  public readonly eventName = "KnowledgeItemRejected";
  constructor(aggregateId: string, public readonly reason: string, causationId: string | null = null) {
    super(aggregateId, causationId);
  }
}

export class KnowledgeItemPublishedEvent extends BaseDomainEvent {
  public readonly eventName = "KnowledgeItemPublished";
  constructor(aggregateId: string, public readonly publishedVersion: number, causationId: string | null = null) {
    super(aggregateId, causationId);
  }
}

export class KnowledgeItemDeprecatedEvent extends BaseDomainEvent {
  public readonly eventName = "KnowledgeItemDeprecated";
  constructor(aggregateId: string, causationId: string | null = null) {
    super(aggregateId, causationId);
  }
}

export class KnowledgeItemArchivedEvent extends BaseDomainEvent {
  public readonly eventName = "KnowledgeItemArchived";
  constructor(aggregateId: string, causationId: string | null = null) {
    super(aggregateId, causationId);
  }
}

export class KnowledgeItemRolledBackEvent extends BaseDomainEvent {
  public readonly eventName = "KnowledgeItemRolledBack";
  constructor(
    aggregateId: string,
    public readonly restoredFromVersion: number,
    public readonly versionNumber: number,
    causationId: string | null = null,
  ) {
    super(aggregateId, causationId);
  }
}
