import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SemanticSearchUseCase } from "./SemanticSearchUseCase.ts";
import { ProjectItemUseCase } from "./IndexingUseCases.ts";
import { FakeEmbedder, FakeChunkIndexRepository, FakePublishedItemReader } from "../testDoubles/index.ts";
import { ProjectItemCommand, SemanticSearchCommand } from "../command/RetrievalCommands.ts";

async function seededSearch(): Promise<{
  search: SemanticSearchUseCase;
}> {
  const reader = new FakePublishedItemReader();
  const embedder = new FakeEmbedder();
  const index = new FakeChunkIndexRepository();
  reader.add({
    itemId: "item-1",
    companyId: "company-1",
    collectionId: "col-1",
    title: "Refund policy",
    body: "Customers may request a refund within 30 days of purchase.",
    sensitivity: "internal",
    tagIds: [],
    publishedVersion: 1,
    publishedAt: "2026-06-16T00:00:00.000Z",
    stale: false,
  });
  await new ProjectItemUseCase(reader, embedder, index).execute(ProjectItemCommand.of("item-1"));
  return { search: new SemanticSearchUseCase(embedder, index) };
}

describe("SemanticSearchUseCase", () => {
  it("returns ranked results carrying attribution + freshness", async () => {
    const { search } = await seededSearch();
    const results = await search.execute(SemanticSearchCommand.of("company-1", "refund policy"));
    assert.ok(results.length >= 1);
    const top = results[0]!;
    assert.equal(top.itemId, "item-1");
    assert.equal(top.title, "Refund policy");
    assert.equal(top.collectionId, "col-1");
    assert.equal(top.publishedAt, "2026-06-16T00:00:00.000Z");
    assert.equal(typeof top.score, "number");
    assert.equal(top.stale, false);
  });

  it("honours the result limit", async () => {
    const { search } = await seededSearch();
    const results = await search.execute(SemanticSearchCommand.of("company-1", "refund", null, null, null, 1));
    assert.ok(results.length <= 1);
  });

  it("returns nothing when the query is blank (fail-closed)", async () => {
    const { search } = await seededSearch();
    assert.equal((await search.execute(SemanticSearchCommand.of("company-1", ""))).length, 0);
  });

  it("still returns deprecated items, flagged stale, so consumers can decide (ADR-020)", async () => {
    const reader = new FakePublishedItemReader();
    const embedder = new FakeEmbedder();
    const index = new FakeChunkIndexRepository();
    reader.add({
      itemId: "item-1",
      companyId: "company-1",
      collectionId: "col-1",
      title: "Refund policy",
      body: "Customers may request a refund within 30 days of purchase.",
      sensitivity: "internal",
      tagIds: [],
      publishedVersion: 1,
      publishedAt: "2026-06-16T00:00:00.000Z",
      stale: true,
    });
    await new ProjectItemUseCase(reader, embedder, index).execute(ProjectItemCommand.of("item-1"));
    const search = new SemanticSearchUseCase(embedder, index);

    const results = await search.execute(SemanticSearchCommand.of("company-1", "refund policy"));

    assert.ok(results.length >= 1);
    assert.equal(results[0]!.stale, true);
  });
});
