import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { IngestionWorker } from "./IngestionWorker.ts";
import { ProcessIngestionJobUseCase } from "../../application/usecase/ProcessIngestionJobUseCase.ts";
import { RecoverStuckJobsUseCase } from "../../application/usecase/RecoverStuckJobsUseCase.ts";
import {
  FakeIngestionJobRepository,
  FakeFileStorage,
  FakePlainTextExtractor,
  FakeKnowledgeDraftCreation,
} from "../../application/testDoubles/index.ts";
import { IngestionJob } from "../../domain/aggregates/IngestionJob.ts";
import { IngestionJobId } from "../../domain/identifiers/IngestionJobId.ts";
import { MimeType } from "../../domain/valueObjects/MimeType.ts";
import type { ApplicationService } from "../../../../shared/application/ApplicationService.ts";
import type { UseCase } from "../../../../shared/application/UseCase.ts";

// Runs the use case directly (the real ApplicationService is exercised elsewhere); the
// worker still opens the per-job actor context around this call.
const fakeApplicationService = {
  execute<C, R>(useCase: UseCase<C, R>, command: C): Promise<R> {
    return useCase.execute(command);
  },
} as unknown as ApplicationService;

describe("IngestionWorker", () => {
  it("drains pending jobs, processing each to done", async () => {
    const jobRepository = new FakeIngestionJobRepository();
    const storage = new FakeFileStorage();
    const job = IngestionJob.upload(
      new IngestionJobId("j1"),
      "company-1",
      "col-1",
      "doc.md",
      new MimeType("text/markdown"),
      "company-1/j1",
      "curator-1",
    );
    await jobRepository.save(job);
    await storage.store("company-1", "company-1/j1", Buffer.from("# Body"));

    const process = new ProcessIngestionJobUseCase(
      jobRepository,
      storage,
      [new FakePlainTextExtractor()],
      new FakeKnowledgeDraftCreation("item-1"),
    );
    const worker = new IngestionWorker(
      fakeApplicationService,
      jobRepository,
      process,
      new RecoverStuckJobsUseCase(jobRepository),
    );

    const processed = await worker.processOnce();

    assert.equal(processed, 1);
    assert.equal((await jobRepository.findById(new IngestionJobId("j1")))?.status, "done");
  });

  it("recover() requeues stuck processing jobs", async () => {
    const jobRepository = new FakeIngestionJobRepository();
    const stuck = IngestionJob.upload(
      new IngestionJobId("j1"),
      "company-1",
      "col-1",
      "doc.md",
      new MimeType("text/markdown"),
      "company-1/j1",
      "curator-1",
    );
    stuck.startProcessing();
    await jobRepository.save(stuck);

    const worker = new IngestionWorker(
      fakeApplicationService,
      jobRepository,
      new ProcessIngestionJobUseCase(jobRepository, new FakeFileStorage(), [], new FakeKnowledgeDraftCreation()),
      new RecoverStuckJobsUseCase(jobRepository),
    );

    assert.equal(await worker.recover(), 1);
    assert.equal((await jobRepository.findById(new IngestionJobId("j1")))?.status, "pending");
  });
});
