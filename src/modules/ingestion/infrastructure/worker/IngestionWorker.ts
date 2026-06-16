import type { ApplicationService } from "../../../../shared/application/ApplicationService.ts";
import { runWithActor } from "../../../../shared/application/context/ActorContext.ts";
import type { IngestionJobRepositoryPort } from "../../application/types.ts";
import type { ProcessIngestionJobUseCase } from "../../application/usecase/ProcessIngestionJobUseCase.ts";
import type { RecoverStuckJobsUseCase } from "../../application/usecase/RecoverStuckJobsUseCase.ts";
import { ProcessIngestionJobCommand } from "../../application/command/IngestionCommands.ts";

/**
 * In-process ingestion worker (ADR-015, no broker). Drains pending jobs on an interval;
 * each job runs through the ApplicationService in its OWN tenant scope as a `system` actor,
 * so tenant filtering + file-storage fail-closed reads work and the job's events persist.
 * `recover()` runs once at startup to requeue jobs left `processing` by a previous crash.
 */
export class IngestionWorker {
  private readonly applicationService: ApplicationService;
  private readonly jobRepository: IngestionJobRepositoryPort;
  private readonly processUseCase: ProcessIngestionJobUseCase;
  private readonly recoverUseCase: RecoverStuckJobsUseCase;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    applicationService: ApplicationService,
    jobRepository: IngestionJobRepositoryPort,
    processUseCase: ProcessIngestionJobUseCase,
    recoverUseCase: RecoverStuckJobsUseCase,
  ) {
    this.applicationService = applicationService;
    this.jobRepository = jobRepository;
    this.processUseCase = processUseCase;
    this.recoverUseCase = recoverUseCase;
  }

  public async recover(): Promise<number> {
    return runWithActor({ companyId: null, actorId: "system", actorType: "system" }, () =>
      this.applicationService.execute(this.recoverUseCase, undefined),
    );
  }

  public async processOnce(): Promise<number> {
    const pending = await this.jobRepository.listByStatus("pending");
    for (const job of pending) {
      await runWithActor(
        { companyId: job.companyId, actorId: "system", actorType: "system" },
        () => this.applicationService.execute(this.processUseCase, ProcessIngestionJobCommand.of(job.id.value)),
      );
    }
    return pending.length;
  }

  public start(intervalMs: number): void {
    if (this.timer !== null) {
      return;
    }
    this.timer = setInterval(() => {
      void this.processOnce().catch(() => {
        // a failed drain cycle must not crash the worker; per-job failures are recorded on the job
      });
    }, intervalMs);
    this.timer.unref?.();
  }

  public stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
