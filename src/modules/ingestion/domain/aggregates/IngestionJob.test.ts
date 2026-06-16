import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { IngestionJob } from "./IngestionJob.ts";
import { IngestionJobId } from "../identifiers/IngestionJobId.ts";
import { MimeType } from "../valueObjects/MimeType.ts";

function uploaded(): IngestionJob {
  return IngestionJob.upload(
    new IngestionJobId("j1"),
    "company-1",
    "col-1",
    "policy.md",
    new MimeType("text/markdown"),
    "company-1/j1",
    "curator-1",
  );
}

function lastEvent(job: IngestionJob): string {
  const events = job.getDomainEvents();
  return events[events.length - 1]!.eventName;
}

describe("IngestionJob", () => {
  it("uploads as pending and emits DocumentUploaded", () => {
    const job = uploaded();
    assert.equal(job.status, "pending");
    assert.equal(job.companyId, "company-1");
    assert.equal(job.isPending(), true);
    assert.equal(job.getDomainEvents()[0]!.eventName, "DocumentUploaded");
  });

  it("drives pending → processing → done with the created item id", () => {
    const job = uploaded();
    job.startProcessing();
    assert.equal(job.status, "processing");
    assert.equal(lastEvent(job), "IngestionStarted");

    job.complete("item-99");
    assert.equal(job.status, "done");
    assert.equal(job.createdItemId, "item-99");
    assert.equal(lastEvent(job), "IngestionCompleted");
  });

  it("fails from pending or processing with a reason", () => {
    const job = uploaded();
    job.startProcessing();
    job.fail("extraction error");
    assert.equal(job.status, "failed");
    assert.equal(job.failureReason, "extraction error");
    assert.equal(lastEvent(job), "IngestionFailed");
  });

  it("requeues a stuck processing job for recovery", () => {
    const job = uploaded();
    job.startProcessing();
    job.markForRetry();
    assert.equal(job.status, "pending");
  });

  it("rejects invalid transitions", () => {
    const job = uploaded();
    assert.throws(() => job.complete("x"), /Cannot complete/); // not processing
    job.startProcessing();
    assert.throws(() => job.startProcessing(), /Cannot start processing/);
    job.complete("item-1");
    assert.throws(() => job.fail("late"), /Cannot fail/); // already done
    assert.throws(() => job.markForRetry(), /Cannot requeue/);
  });

  it("reconstitutes without events", () => {
    const job = IngestionJob.reconstitute({
      id: new IngestionJobId("j1"),
      companyId: "company-1",
      collectionId: "col-1",
      filename: "p.md",
      mimeType: new MimeType("text/markdown"),
      storageRef: "company-1/j1",
      status: "done",
      createdItemId: "item-1",
      failureReason: null,
      createdBy: "curator-1",
      createdAt: new Date("2026-06-16T00:00:00.000Z"),
    });
    assert.equal(job.status, "done");
    assert.equal(job.getDomainEvents().length, 0);
  });
});
