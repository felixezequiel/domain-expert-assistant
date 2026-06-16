import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type {
  IngestionJobRepositoryPort,
  FileStoragePort,
  ExtractorPort,
  KnowledgeDraftCreationPort,
} from "../types.ts";
import type { ProcessIngestionJobCommand } from "../command/IngestionCommands.ts";
import type { IngestionJob } from "../../domain/aggregates/IngestionJob.ts";

/**
 * Processes one pending job (driven by the worker, in the job's tenant scope as a system
 * actor). Idempotent: a non-pending job is a no-op. Extraction → Knowledge draft creation
 * is wrapped so any failure marks the job `failed` with the reason instead of throwing.
 */
export class ProcessIngestionJobUseCase implements UseCase<ProcessIngestionJobCommand, IngestionJob | null> {
  private readonly jobRepository: IngestionJobRepositoryPort;
  private readonly fileStorage: FileStoragePort;
  private readonly extractors: ReadonlyArray<ExtractorPort>;
  private readonly knowledgeDraftCreation: KnowledgeDraftCreationPort;

  constructor(
    jobRepository: IngestionJobRepositoryPort,
    fileStorage: FileStoragePort,
    extractors: ReadonlyArray<ExtractorPort>,
    knowledgeDraftCreation: KnowledgeDraftCreationPort,
  ) {
    this.jobRepository = jobRepository;
    this.fileStorage = fileStorage;
    this.extractors = extractors;
    this.knowledgeDraftCreation = knowledgeDraftCreation;
  }

  public async execute(command: ProcessIngestionJobCommand): Promise<IngestionJob | null> {
    const job = await this.jobRepository.findById(command.jobId);
    if (job === null) {
      return null;
    }
    if (!job.isPending()) {
      return job;
    }

    job.startProcessing();
    try {
      const bytes = await this.fileStorage.read(job.companyId, job.storageRef);
      const extractor = this.findExtractor(job.mimeType.value);
      const text = await extractor.extract(bytes);
      const createdItemId = await this.knowledgeDraftCreation.createDraftFromDocument({
        companyId: job.companyId,
        collectionId: job.collectionId,
        title: job.filename,
        body: text,
        createdBy: job.createdBy,
      });
      job.complete(createdItemId);
    } catch (error) {
      job.fail(error instanceof Error ? error.message : "Ingestion failed");
    }
    return job;
  }

  private findExtractor(mimeType: string): ExtractorPort {
    for (const extractor of this.extractors) {
      if (extractor.supports(mimeType)) {
        return extractor;
      }
    }
    throw new Error("No extractor available for mime type: " + mimeType);
  }
}
