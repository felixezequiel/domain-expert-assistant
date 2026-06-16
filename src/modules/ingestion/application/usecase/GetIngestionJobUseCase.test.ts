import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GetIngestionJobUseCase } from "./GetIngestionJobUseCase.ts";
import { FakeIngestionJobRepository } from "../testDoubles/index.ts";
import { IngestionJob } from "../../domain/aggregates/IngestionJob.ts";
import { IngestionJobId } from "../../domain/identifiers/IngestionJobId.ts";
import { MimeType } from "../../domain/valueObjects/MimeType.ts";

describe("GetIngestionJobUseCase", () => {
  it("returns a view for a known job and null otherwise", async () => {
    const repo = new FakeIngestionJobRepository();
    await repo.save(
      IngestionJob.upload(
        new IngestionJobId("j1"),
        "company-1",
        "col-1",
        "doc.md",
        new MimeType("text/markdown"),
        "company-1/j1",
        "curator-1",
      ),
    );
    const useCase = new GetIngestionJobUseCase(repo);

    const view = await useCase.execute("j1");
    assert.equal(view?.id, "j1");
    assert.equal(view?.status, "pending");
    assert.equal(view?.filename, "doc.md");

    assert.equal(await useCase.execute("missing"), null);
  });
});
