import type {
  IngestionJobRepositoryPort,
  FileStoragePort,
  ExtractorPort,
  KnowledgeDraftCreationPort,
  CreateDraftFromDocumentInput,
} from "../types.ts";
import type { IngestionJob } from "../../domain/aggregates/IngestionJob.ts";
import type { IngestionJobId } from "../../domain/identifiers/IngestionJobId.ts";
import type { IngestionStatus } from "../../domain/valueObjects/IngestionStatus.ts";

export class FakeIngestionJobRepository implements IngestionJobRepositoryPort {
  private readonly jobs = new Map<string, IngestionJob>();

  public async save(job: IngestionJob): Promise<void> {
    this.jobs.set(job.id.value, job);
  }
  public async findById(id: IngestionJobId): Promise<IngestionJob | null> {
    return this.jobs.get(id.value) ?? null;
  }
  public async listByStatus(status: IngestionStatus): Promise<ReadonlyArray<IngestionJob>> {
    const result: Array<IngestionJob> = [];
    for (const job of this.jobs.values()) {
      if (job.status === status) {
        result.push(job);
      }
    }
    return result;
  }
}

export class FakeFileStorage implements FileStoragePort {
  private readonly files = new Map<string, Buffer>();

  public async store(companyId: string, storageRef: string, content: Buffer): Promise<void> {
    this.files.set(companyId + "::" + storageRef, content);
  }
  public async read(companyId: string, storageRef: string): Promise<Buffer> {
    const content = this.files.get(companyId + "::" + storageRef);
    if (content === undefined) {
      throw new Error("File not found: " + storageRef);
    }
    return content;
  }
}

export class FakePlainTextExtractor implements ExtractorPort {
  public supports(mimeType: string): boolean {
    return mimeType === "text/plain" || mimeType === "text/markdown";
  }
  public async extract(content: Buffer): Promise<string> {
    return content.toString("utf8");
  }
}

export class FakeKnowledgeDraftCreation implements KnowledgeDraftCreationPort {
  public lastInput: CreateDraftFromDocumentInput | null = null;
  constructor(private readonly itemId: string = "created-item") {}
  public async createDraftFromDocument(input: CreateDraftFromDocumentInput): Promise<string> {
    this.lastInput = input;
    return this.itemId;
  }
}

/** An extractor that always throws — to test the failure path. */
export class FailingExtractor implements ExtractorPort {
  public supports(): boolean {
    return true;
  }
  public async extract(): Promise<string> {
    throw new Error("extraction blew up");
  }
}
