import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RecoverStuckJobsUseCase } from "./RecoverStuckJobsUseCase.ts";
import { FakeIngestionJobRepository } from "../testDoubles/index.ts";
import { IngestionJob } from "../../domain/aggregates/IngestionJob.ts";
import { IngestionJobId } from "../../domain/identifiers/IngestionJobId.ts";
import { MimeType } from "../../domain/valueObjects/MimeType.ts";

function processingJob(id: string): IngestionJob {
  const job = IngestionJob.upload(
    new IngestionJobId(id),
    "company-1",
    "col-1",
    id + ".md",
    new MimeType("text/markdown"),
    "company-1/" + id,
    "curator-1",
  );
  job.startProcessing();
  return job;
}

describe("RecoverStuckJobsUseCase", () => {
  it("requeues every processing job and reports the count", async () => {
    const repo = new FakeIngestionJobRepository();
    await repo.save(processingJob("j1"));
    await repo.save(processingJob("j2"));
    const pending = IngestionJob.upload(
      new IngestionJobId("j3"),
      "company-1",
      "col-1",
      "j3.md",
      new MimeType("text/markdown"),
      "company-1/j3",
      "curator-1",
    );
    await repo.save(pending);
    const useCase = new RecoverStuckJobsUseCase(repo);

    const count = await useCase.execute();

    assert.equal(count, 2);
    assert.equal((await repo.listByStatus("pending")).length, 3); // j1, j2 requeued + j3
  });

  it("returns 0 when nothing is stuck", async () => {
    assert.equal(await new RecoverStuckJobsUseCase(new FakeIngestionJobRepository()).execute(), 0);
  });
});
