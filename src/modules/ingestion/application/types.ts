import type { IngestionJob } from "../domain/aggregates/IngestionJob.ts";
import type { IngestionJobId } from "../domain/identifiers/IngestionJobId.ts";
import type { IngestionStatus } from "../domain/valueObjects/IngestionStatus.ts";

/**
 * Secondary ports for the Ingestion context. Repositories stage writes only — the
 * UnitOfWork owns the single flush at commit (ADR-004); they never call flush themselves.
 */
export interface IngestionJobRepositoryPort {
  save(job: IngestionJob): Promise<void>;
  findById(id: IngestionJobId): Promise<IngestionJob | null>;
  listByStatus(status: IngestionStatus): Promise<ReadonlyArray<IngestionJob>>;
}

/**
 * Raw file bytes behind a port (ADR-016): fs-local now, S3 later. `storageRef` is scoped by
 * companyId; `read` is fail-closed — it throws if the requested companyId does not match the
 * current actor-context tenant, so a leaked/forged ref can never read another tenant's bytes.
 */
export interface FileStoragePort {
  store(companyId: string, storageRef: string, content: Buffer): Promise<void>;
  read(companyId: string, storageRef: string): Promise<Buffer>;
}

/**
 * Extracts text from a document's bytes by mime type (ADR-015). One adapter per format
 * behind this port; the processor picks the first that `supports` the job's mime type.
 */
export interface ExtractorPort {
  supports(mimeType: string): boolean;
  extract(content: Buffer): Promise<string>;
}

/**
 * The cross-context port Ingestion owns to turn an extracted document into a Knowledge draft
 * item, without importing the Knowledge aggregates. Knowledge/composition provides the adapter.
 */
export interface CreateDraftFromDocumentInput {
  readonly companyId: string;
  readonly collectionId: string;
  readonly title: string;
  readonly body: string;
  readonly createdBy: string;
  // The originating ingestion job id, stamped as the draft's causation so the audit trail
  // can correlate the created item back to its upload (PRD-3 audit linkage / ADR-024).
  readonly causationId: string;
}

export interface KnowledgeDraftCreationPort {
  createDraftFromDocument(input: CreateDraftFromDocumentInput): Promise<string>;
}

export interface IngestionJobView {
  readonly id: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly status: string;
  readonly createdItemId: string | null;
  readonly failureReason: string | null;
}
