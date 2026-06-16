import { AggregateRoot } from "../../../../shared/domain/aggregates/AggregateRoot.ts";
import type { TenantScoped } from "../../../../shared/domain/TenantScoped.ts";
import type { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";
import type { KnowledgeItemId } from "../identifiers/KnowledgeItemId.ts";
import type { CollectionId } from "../identifiers/CollectionId.ts";
import type { TagId } from "../identifiers/TagId.ts";
import type { Title } from "../valueObjects/Title.ts";
import type { KnowledgeBody } from "../valueObjects/KnowledgeBody.ts";
import type { LifecycleStatus } from "../valueObjects/LifecycleStatus.ts";
import {
  KnowledgeItemDraftedEvent,
  KnowledgeItemEditedEvent,
  KnowledgeItemRetaggedEvent,
  KnowledgeItemMovedToCollectionEvent,
  KnowledgeItemSubmittedForReviewEvent,
  KnowledgeItemRejectedEvent,
  KnowledgeItemPublishedEvent,
  KnowledgeItemDeprecatedEvent,
  KnowledgeItemArchivedEvent,
  KnowledgeItemRolledBackEvent,
} from "../events/KnowledgeItemEvents.ts";

const FIRST_VERSION = 1;

interface KnowledgeItemProps {
  readonly companyId: string;
  collectionId: CollectionId;
  title: Title;
  body: KnowledgeBody;
  tagIds: ReadonlyArray<TagId>;
  sensitivity: SensitivityLevel;
  status: LifecycleStatus;
  currentVersionNumber: number;
  publishedVersionNumber: number | null;
  readonly authorId: string;
  lastEditorId: string;
  readonly createdAt: Date;
}

/**
 * The product's core aggregate (ADR-012/013). Holds the current working content + the
 * lifecycle `status` of the working version + two pointers: `currentVersionNumber` and
 * `publishedVersionNumber` (what *serves*). It never carries the version history — those
 * append-only snapshots live outside, written by the use case in the same transaction.
 *
 * Lifecycle transitions are guarded methods; an invalid transition throws a domain error.
 * Editing/reviewing a new version never unpublishes the served one — `publishedVersionNumber`
 * only moves on approve.
 */
export class KnowledgeItem extends AggregateRoot<KnowledgeItemId, KnowledgeItemProps> implements TenantScoped {
  public get companyId(): string {
    return this.props.companyId;
  }

  public get collectionId(): CollectionId {
    return this.props.collectionId;
  }

  public get title(): Title {
    return this.props.title;
  }

  public get body(): KnowledgeBody {
    return this.props.body;
  }

  public get tagIds(): ReadonlyArray<TagId> {
    return this.props.tagIds;
  }

  public get sensitivity(): SensitivityLevel {
    return this.props.sensitivity;
  }

  public get status(): LifecycleStatus {
    return this.props.status;
  }

  public get currentVersionNumber(): number {
    return this.props.currentVersionNumber;
  }

  public get publishedVersionNumber(): number | null {
    return this.props.publishedVersionNumber;
  }

  public get authorId(): string {
    return this.props.authorId;
  }

  public get lastEditorId(): string {
    return this.props.lastEditorId;
  }

  /** Served to consumers when there is a published version and it has not been archived (ADR-013). */
  public isServed(): boolean {
    return this.props.publishedVersionNumber !== null && this.props.status !== "archived";
  }

  /** Served but flagged as outdated. */
  public isStale(): boolean {
    return this.props.status === "deprecated";
  }

  public static create(
    id: KnowledgeItemId,
    companyId: string,
    collectionId: CollectionId,
    title: Title,
    body: KnowledgeBody,
    tagIds: ReadonlyArray<TagId>,
    sensitivity: SensitivityLevel,
    authorId: string,
  ): KnowledgeItem {
    const item = new KnowledgeItem(id, {
      companyId,
      collectionId,
      title,
      body,
      tagIds: [...tagIds],
      sensitivity,
      status: "draft",
      currentVersionNumber: FIRST_VERSION,
      publishedVersionNumber: null,
      authorId,
      lastEditorId: authorId,
      createdAt: new Date(),
    });
    item.addDomainEvent(
      new KnowledgeItemDraftedEvent(id.value, title.value, collectionId.value, FIRST_VERSION),
    );
    return item;
  }

  public static reconstitute(props: {
    id: KnowledgeItemId;
    companyId: string;
    collectionId: CollectionId;
    title: Title;
    body: KnowledgeBody;
    tagIds: ReadonlyArray<TagId>;
    sensitivity: SensitivityLevel;
    status: LifecycleStatus;
    currentVersionNumber: number;
    publishedVersionNumber: number | null;
    authorId: string;
    lastEditorId: string;
    createdAt: Date;
  }): KnowledgeItem {
    return new KnowledgeItem(props.id, {
      companyId: props.companyId,
      collectionId: props.collectionId,
      title: props.title,
      body: props.body,
      tagIds: [...props.tagIds],
      sensitivity: props.sensitivity,
      status: props.status,
      currentVersionNumber: props.currentVersionNumber,
      publishedVersionNumber: props.publishedVersionNumber,
      authorId: props.authorId,
      lastEditorId: props.lastEditorId,
      createdAt: props.createdAt,
    });
  }

  public edit(title: Title, body: KnowledgeBody, sensitivity: SensitivityLevel, editorId: string): void {
    this.assertStatusIn(["draft", "published"], "edit");
    this.props.title = title;
    this.props.body = body;
    this.props.sensitivity = sensitivity;
    this.openNewWorkingVersion(editorId);
    this.addDomainEvent(new KnowledgeItemEditedEvent(this.id.value, this.props.currentVersionNumber));
  }

  public retag(tagIds: ReadonlyArray<TagId>, editorId: string): void {
    this.assertStatusIn(["draft", "published"], "retag");
    this.props.tagIds = [...tagIds];
    this.openNewWorkingVersion(editorId);
    this.addDomainEvent(new KnowledgeItemRetaggedEvent(this.id.value, this.props.currentVersionNumber));
  }

  public moveToCollection(collectionId: CollectionId): void {
    this.assertNotArchived("move to another collection");
    this.props.collectionId = collectionId;
    this.addDomainEvent(new KnowledgeItemMovedToCollectionEvent(this.id.value, collectionId.value));
  }

  public submitForReview(): void {
    this.assertStatusIn(["draft"], "submit for review");
    this.props.status = "in_review";
    this.addDomainEvent(new KnowledgeItemSubmittedForReviewEvent(this.id.value));
  }

  public approve(reviewerId: string, requireSeparateReviewer: boolean): void {
    this.assertStatusIn(["in_review"], "approve");
    if (requireSeparateReviewer && (reviewerId === this.props.lastEditorId || reviewerId === this.props.authorId)) {
      throw new Error("Approval requires a reviewer different from the author/last editor");
    }
    this.props.status = "published";
    this.props.publishedVersionNumber = this.props.currentVersionNumber;
    this.addDomainEvent(new KnowledgeItemPublishedEvent(this.id.value, this.props.currentVersionNumber));
  }

  public reject(reason: string): void {
    this.assertStatusIn(["in_review"], "reject");
    const trimmedReason = reason.trim();
    if (trimmedReason.length === 0) {
      throw new Error("A rejection reason is required");
    }
    this.props.status = "draft";
    this.addDomainEvent(new KnowledgeItemRejectedEvent(this.id.value, trimmedReason));
  }

  public deprecate(): void {
    this.assertStatusIn(["published"], "deprecate");
    this.props.status = "deprecated";
    this.addDomainEvent(new KnowledgeItemDeprecatedEvent(this.id.value));
  }

  public archive(): void {
    this.assertStatusIn(["published", "deprecated"], "archive");
    this.props.status = "archived";
    this.addDomainEvent(new KnowledgeItemArchivedEvent(this.id.value));
  }

  public rollbackTo(
    restoredFromVersion: number,
    title: Title,
    body: KnowledgeBody,
    tagIds: ReadonlyArray<TagId>,
    sensitivity: SensitivityLevel,
    editorId: string,
  ): void {
    this.assertNotArchived("roll back");
    this.props.title = title;
    this.props.body = body;
    this.props.tagIds = [...tagIds];
    this.props.sensitivity = sensitivity;
    this.openNewWorkingVersion(editorId);
    this.addDomainEvent(
      new KnowledgeItemRolledBackEvent(this.id.value, restoredFromVersion, this.props.currentVersionNumber),
    );
  }

  private openNewWorkingVersion(editorId: string): void {
    this.props.currentVersionNumber += 1;
    this.props.status = "draft";
    this.props.lastEditorId = editorId;
  }

  private assertStatusIn(allowed: ReadonlyArray<LifecycleStatus>, action: string): void {
    if (!allowed.includes(this.props.status)) {
      throw new Error("Cannot " + action + " a knowledge item in status '" + this.props.status + "'");
    }
  }

  private assertNotArchived(action: string): void {
    if (this.props.status === "archived") {
      throw new Error("Cannot " + action + " an archived knowledge item");
    }
  }
}
