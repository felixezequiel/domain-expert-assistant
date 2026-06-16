import { AggregateRoot } from "../../../../shared/domain/aggregates/AggregateRoot.ts";
import type { TenantScoped } from "../../../../shared/domain/TenantScoped.ts";
import type { IngestionJobId } from "../identifiers/IngestionJobId.ts";
import type { MimeType } from "../valueObjects/MimeType.ts";
import type { IngestionStatus } from "../valueObjects/IngestionStatus.ts";
import {
  DocumentUploadedEvent,
  IngestionStartedEvent,
  IngestionCompletedEvent,
  IngestionFailedEvent,
  IngestionRequeuedEvent,
} from "../events/IngestionEvents.ts";

interface IngestionJobProps {
  readonly companyId: string;
  readonly collectionId: string;
  readonly filename: string;
  readonly mimeType: MimeType;
  readonly storageRef: string;
  status: IngestionStatus;
  createdItemId: string | null;
  failureReason: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
}

/**
 * An async document-ingestion job (ADR-015). The `ingestion_jobs` table is the work queue:
 * upload creates a `pending` job and returns immediately; the in-process worker drives it
 * `processing → done | failed`. Transitions are guarded; an invalid one throws. Reprocessing
 * is idempotent at the use-case level (it checks `isPending` first).
 */
export class IngestionJob extends AggregateRoot<IngestionJobId, IngestionJobProps> implements TenantScoped {
  public get companyId(): string {
    return this.props.companyId;
  }

  public get collectionId(): string {
    return this.props.collectionId;
  }

  public get filename(): string {
    return this.props.filename;
  }

  public get mimeType(): MimeType {
    return this.props.mimeType;
  }

  public get storageRef(): string {
    return this.props.storageRef;
  }

  public get status(): IngestionStatus {
    return this.props.status;
  }

  public get createdItemId(): string | null {
    return this.props.createdItemId;
  }

  public get failureReason(): string | null {
    return this.props.failureReason;
  }

  public get createdBy(): string {
    return this.props.createdBy;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public isPending(): boolean {
    return this.props.status === "pending";
  }

  public static upload(
    id: IngestionJobId,
    companyId: string,
    collectionId: string,
    filename: string,
    mimeType: MimeType,
    storageRef: string,
    createdBy: string,
  ): IngestionJob {
    const job = new IngestionJob(id, {
      companyId,
      collectionId,
      filename,
      mimeType,
      storageRef,
      status: "pending",
      createdItemId: null,
      failureReason: null,
      createdBy,
      createdAt: new Date(),
    });
    job.addDomainEvent(new DocumentUploadedEvent(id.value, filename, mimeType.value));
    return job;
  }

  public static reconstitute(props: {
    id: IngestionJobId;
    companyId: string;
    collectionId: string;
    filename: string;
    mimeType: MimeType;
    storageRef: string;
    status: IngestionStatus;
    createdItemId: string | null;
    failureReason: string | null;
    createdBy: string;
    createdAt: Date;
  }): IngestionJob {
    return new IngestionJob(props.id, {
      companyId: props.companyId,
      collectionId: props.collectionId,
      filename: props.filename,
      mimeType: props.mimeType,
      storageRef: props.storageRef,
      status: props.status,
      createdItemId: props.createdItemId,
      failureReason: props.failureReason,
      createdBy: props.createdBy,
      createdAt: props.createdAt,
    });
  }

  public startProcessing(): void {
    this.assertStatus("pending", "start processing");
    this.props.status = "processing";
    this.addDomainEvent(new IngestionStartedEvent(this.id.value));
  }

  public complete(createdItemId: string): void {
    this.assertStatus("processing", "complete");
    this.props.status = "done";
    this.props.createdItemId = createdItemId;
    this.addDomainEvent(new IngestionCompletedEvent(this.id.value, createdItemId));
  }

  public fail(reason: string): void {
    if (this.props.status !== "pending" && this.props.status !== "processing") {
      throw new Error("Cannot fail an ingestion job in status '" + this.props.status + "'");
    }
    this.props.status = "failed";
    this.props.failureReason = reason;
    this.addDomainEvent(new IngestionFailedEvent(this.id.value, reason));
  }

  /** Stuck-job recovery on startup (ADR-015): a job left `processing` is returned to the queue. */
  public markForRetry(): void {
    this.assertStatus("processing", "requeue");
    this.props.status = "pending";
    this.addDomainEvent(new IngestionRequeuedEvent(this.id.value));
  }

  private assertStatus(expected: IngestionStatus, action: string): void {
    if (this.props.status !== expected) {
      throw new Error("Cannot " + action + " an ingestion job in status '" + this.props.status + "'");
    }
  }
}
