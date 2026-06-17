import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ProcessIngestionJobUseCase } from "./ProcessIngestionJobUseCase.ts";
import { ProcessIngestionJobCommand } from "../command/IngestionCommands.ts";
import {
  FakeIngestionJobRepository,
  FakeFileStorage,
  FakePlainTextExtractor,
  FakeKnowledgeDraftCreation,
  FailingExtractor,
} from "../testDoubles/index.ts";
import { IngestionJob } from "../../domain/aggregates/IngestionJob.ts";
import { IngestionJobId } from "../../domain/identifiers/IngestionJobId.ts";
import { MimeType } from "../../domain/valueObjects/MimeType.ts";

async function pendingJob(repo: FakeIngestionJobRepository, storage: FakeFileStorage): Promise<void> {
  const job = IngestionJob.upload(
    new IngestionJobId("j1"),
    "company-1",
    "col-1",
    "policy.md",
    new MimeType("text/markdown"),
    "company-1/j1",
    "curator-1",
  );
  await repo.save(job);
  await storage.store("company-1", "company-1/j1", Buffer.from("# Refund policy\n\nDetails."));
}

describe("ProcessIngestionJobUseCase", () => {
  it("extracts text, creates a Knowledge draft, and completes the job", async () => {
    const repo = new FakeIngestionJobRepository();
    const storage = new FakeFileStorage();
    await pendingJob(repo, storage);
    const draft = new FakeKnowledgeDraftCreation("item-42");
    const useCase = new ProcessIngestionJobUseCase(repo, storage, [new FakePlainTextExtractor()], draft);

    const job = await useCase.execute(ProcessIngestionJobCommand.of("j1"));

    assert.equal(job?.status, "done");
    assert.equal(job?.createdItemId, "item-42");
    // Title prefers the document's first markdown heading over the raw filename (finding U9).
    assert.equal(draft.lastInput?.title, "Refund policy");
    assert.equal(draft.lastInput?.body, "# Refund policy\n\nDetails.");
    assert.equal(draft.lastInput?.companyId, "company-1");
  });

  it("falls back to the filename without its extension when there is no heading", async () => {
    const repo = new FakeIngestionJobRepository();
    const storage = new FakeFileStorage();
    const job = IngestionJob.upload(
      new IngestionJobId("j2"),
      "company-1",
      "col-1",
      "onboarding-guide.md",
      new MimeType("text/markdown"),
      "company-1/j2",
      "curator-1",
    );
    await repo.save(job);
    await storage.store("company-1", "company-1/j2", Buffer.from("Welcome aboard. No heading here."));
    const draft = new FakeKnowledgeDraftCreation("item-7");
    const useCase = new ProcessIngestionJobUseCase(repo, storage, [new FakePlainTextExtractor()], draft);

    await useCase.execute(ProcessIngestionJobCommand.of("j2"));

    assert.equal(draft.lastInput?.title, "onboarding-guide");
  });

  it("is idempotent — a non-pending job is returned unchanged", async () => {
    const repo = new FakeIngestionJobRepository();
    const storage = new FakeFileStorage();
    await pendingJob(repo, storage);
    const useCase = new ProcessIngestionJobUseCase(repo, storage, [new FakePlainTextExtractor()], new FakeKnowledgeDraftCreation());

    await useCase.execute(ProcessIngestionJobCommand.of("j1")); // done
    const second = await useCase.execute(ProcessIngestionJobCommand.of("j1"));
    assert.equal(second?.status, "done");
  });

  it("marks the job failed when extraction throws", async () => {
    const repo = new FakeIngestionJobRepository();
    const storage = new FakeFileStorage();
    await pendingJob(repo, storage);
    const useCase = new ProcessIngestionJobUseCase(repo, storage, [new FailingExtractor()], new FakeKnowledgeDraftCreation());

    const job = await useCase.execute(ProcessIngestionJobCommand.of("j1"));
    assert.equal(job?.status, "failed");
    assert.equal(job?.failureReason, "extraction blew up");
  });

  it("fails when no extractor supports the mime type", async () => {
    const repo = new FakeIngestionJobRepository();
    const storage = new FakeFileStorage();
    await pendingJob(repo, storage);
    const useCase = new ProcessIngestionJobUseCase(repo, storage, [], new FakeKnowledgeDraftCreation());

    const job = await useCase.execute(ProcessIngestionJobCommand.of("j1"));
    assert.equal(job?.status, "failed");
    assert.match(job?.failureReason ?? "", /No extractor/);
  });

  it("returns null for an unknown job", async () => {
    const useCase = new ProcessIngestionJobUseCase(
      new FakeIngestionJobRepository(),
      new FakeFileStorage(),
      [new FakePlainTextExtractor()],
      new FakeKnowledgeDraftCreation(),
    );
    assert.equal(await useCase.execute(ProcessIngestionJobCommand.of("ghost")), null);
  });
});
