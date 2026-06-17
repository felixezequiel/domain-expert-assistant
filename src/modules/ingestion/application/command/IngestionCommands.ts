import { MimeType } from "../../domain/valueObjects/MimeType.ts";
import { IngestionJobId } from "../../domain/identifiers/IngestionJobId.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

const BYTES_PER_KIBIBYTE = 1024;
const KIBIBYTES_PER_MEBIBYTE = 1024;
const DEFAULT_MAX_UPLOAD_MEBIBYTES = 10;
const DEFAULT_MAX_UPLOAD_BYTES =
  DEFAULT_MAX_UPLOAD_MEBIBYTES * KIBIBYTES_PER_MEBIBYTE * BYTES_PER_KIBIBYTE;

/**
 * Maximum decoded upload size accepted at reception. Defaults to 10 MiB and is overridable
 * via INGESTION_MAX_UPLOAD_BYTES so an operator can tune it per deployment. Resolved once at
 * module load; a non-positive or non-numeric override falls back to the default.
 */
export function resolveMaxUploadBytes(): number {
  const raw = process.env.INGESTION_MAX_UPLOAD_BYTES;
  if (raw === undefined) {
    return DEFAULT_MAX_UPLOAD_BYTES;
  }
  const parsed = Number(raw);
  const isUsable = Number.isFinite(parsed) && parsed > 0;
  return isUsable ? parsed : DEFAULT_MAX_UPLOAD_BYTES;
}

export const MAX_UPLOAD_BYTES = resolveMaxUploadBytes();

/**
 * Upload a document for async ingestion. The content arrives as raw bytes (the HTTP edge
 * decodes the base64 body); the use case stores it and returns immediately (ADR-015).
 */
export class UploadDocumentCommand {
  public readonly collectionId: string;
  public readonly filename: string;
  public readonly mimeType: MimeType;
  public readonly content: Buffer;

  private constructor(collectionId: string, filename: string, mimeType: MimeType, content: Buffer) {
    this.collectionId = collectionId;
    this.filename = filename;
    this.mimeType = mimeType;
    this.content = content;
  }

  public static of(
    collectionId: string,
    filename: string,
    mimeType: string,
    content: Buffer,
    maxBytes: number = MAX_UPLOAD_BYTES,
  ): UploadDocumentCommand {
    if (collectionId.trim().length === 0) {
      throw new DomainError(
        "common.fieldRequired",
        "validation",
        { field: "collectionId" },
        "collectionId is required",
      );
    }
    if (filename.trim().length === 0) {
      throw new DomainError("common.fieldRequired", "validation", { field: "filename" }, "filename is required");
    }
    if (content.length === 0) {
      throw new DomainError("ingestion.emptyContent", "validation", undefined, "Document content is empty");
    }
    if (content.length > maxBytes) {
      throw new DomainError(
        "ingestion.contentTooLarge",
        "validation",
        { size: content.length, maxBytes },
        "Document content is too large: " + content.length + " bytes exceeds the limit of " + maxBytes + " bytes",
      );
    }
    return new UploadDocumentCommand(collectionId, filename.trim(), new MimeType(mimeType), content);
  }
}

export class ProcessIngestionJobCommand {
  public readonly jobId: IngestionJobId;

  private constructor(jobId: IngestionJobId) {
    this.jobId = jobId;
  }

  public static of(jobId: string): ProcessIngestionJobCommand {
    return new ProcessIngestionJobCommand(new IngestionJobId(jobId));
  }
}
