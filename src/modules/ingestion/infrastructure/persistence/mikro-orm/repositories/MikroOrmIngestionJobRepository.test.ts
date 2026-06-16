import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MikroOrmIngestionJobRepository } from "./MikroOrmIngestionJobRepository.ts";
import { createFakeEntityManagerProvider } from "./testing/index.ts";
import { IngestionJob } from "../../../../domain/aggregates/IngestionJob.ts";
import { IngestionJobId } from "../../../../domain/identifiers/IngestionJobId.ts";
import { MimeType } from "../../../../domain/valueObjects/MimeType.ts";

function job(id: string): IngestionJob {
  return IngestionJob.upload(
    new IngestionJobId(id),
    "company-1",
    "col-1",
    id + ".md",
    new MimeType("text/markdown"),
    "company-1/" + id,
    "curator-1",
  );
}

describe("MikroOrmIngestionJobRepository", () => {
  it("saves and finds by id", async () => {
    const repo = new MikroOrmIngestionJobRepository(createFakeEntityManagerProvider());
    await repo.save(job("j1"));

    assert.equal((await repo.findById(new IngestionJobId("j1")))?.filename, "j1.md");
    assert.equal(await repo.findById(new IngestionJobId("missing")), null);
  });

  it("lists by status", async () => {
    const repo = new MikroOrmIngestionJobRepository(createFakeEntityManagerProvider());
    await repo.save(job("j1"));
    const processing = job("j2");
    processing.startProcessing();
    await repo.save(processing);

    const pending = await repo.listByStatus("pending");
    assert.deepEqual(pending.map((j) => j.id.value), ["j1"]);
  });
});
