import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { IngestionJobRepositoryPort } from "../types.ts";

/**
 * Startup recovery (ADR-015): any job left `processing` (e.g. the process crashed mid-run)
 * is returned to the queue so the worker picks it up again. Runs in a privileged system
 * scope so it sees stuck jobs across all tenants. Each requeue emits an event, so the
 * status change persists via the normal tracking pipeline at commit.
 */
export class RecoverStuckJobsUseCase implements UseCase<void, number> {
  private readonly jobRepository: IngestionJobRepositoryPort;

  constructor(jobRepository: IngestionJobRepositoryPort) {
    this.jobRepository = jobRepository;
  }

  public async execute(): Promise<number> {
    const stuck = await this.jobRepository.listByStatus("processing");
    for (const job of stuck) {
      job.markForRetry();
    }
    return stuck.length;
  }
}
