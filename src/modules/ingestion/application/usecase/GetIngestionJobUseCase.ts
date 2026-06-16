import type { UseCase } from "../../../../shared/application/UseCase.ts";
import { IngestionJobId } from "../../domain/identifiers/IngestionJobId.ts";
import type { IngestionJobRepositoryPort, IngestionJobView } from "../types.ts";

export class GetIngestionJobUseCase implements UseCase<string, IngestionJobView | null> {
  private readonly jobRepository: IngestionJobRepositoryPort;

  constructor(jobRepository: IngestionJobRepositoryPort) {
    this.jobRepository = jobRepository;
  }

  public async execute(jobId: string): Promise<IngestionJobView | null> {
    const job = await this.jobRepository.findById(new IngestionJobId(jobId));
    if (job === null) {
      return null;
    }
    return {
      id: job.id.value,
      filename: job.filename,
      mimeType: job.mimeType.value,
      status: job.status,
      createdItemId: job.createdItemId,
      failureReason: job.failureReason,
    };
  }
}
