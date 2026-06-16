import { MimeType } from "../../domain/valueObjects/MimeType.ts";
import { IngestionJobId } from "../../domain/identifiers/IngestionJobId.ts";

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
  ): UploadDocumentCommand {
    if (collectionId.trim().length === 0) {
      throw new Error("collectionId is required");
    }
    if (filename.trim().length === 0) {
      throw new Error("filename is required");
    }
    if (content.length === 0) {
      throw new Error("Document content is empty");
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
