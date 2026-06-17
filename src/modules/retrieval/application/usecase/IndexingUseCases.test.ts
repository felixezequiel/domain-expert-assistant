import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  ProjectItemUseCase,
  DeprecateItemIndexUseCase,
  RemoveItemFromIndexUseCase,
  RebuildIndexUseCase,
} from "./IndexingUseCases.ts";
import { SemanticSearchUseCase } from "./SemanticSearchUseCase.ts";
import {
  FakeEmbedder,
  FakeChunkIndexRepository,
  FakePublishedItemReader,
} from "../testDoubles/index.ts";
import {
  ProjectItemCommand,
  DeprecateItemIndexCommand,
  RemoveItemFromIndexCommand,
  RebuildIndexCommand,
  SemanticSearchCommand,
} from "../command/RetrievalCommands.ts";
import type { PublishedItem } from "../types.ts";

function publishedItem(overrides: Partial<PublishedItem> = {}): PublishedItem {
  return {
    itemId: "item-1",
    companyId: "company-1",
    collectionId: "col-1",
    title: "Refund policy",
    body: "Customers may request a refund within 30 days of purchase. Refunds are processed by finance.",
    sensitivity: "internal",
    tagIds: [],
    publishedVersion: 1,
    publishedAt: "2026-06-16T00:00:00.000Z",
    stale: false,
    ...overrides,
  };
}

describe("ProjectItemUseCase", () => {
  let reader: FakePublishedItemReader;
  let embedder: FakeEmbedder;
  let index: FakeChunkIndexRepository;
  let project: ProjectItemUseCase;

  beforeEach(() => {
    reader = new FakePublishedItemReader();
    embedder = new FakeEmbedder();
    index = new FakeChunkIndexRepository();
    project = new ProjectItemUseCase(reader, embedder, index);
  });

  it("indexes a published item and makes it searchable", async () => {
    reader.add(publishedItem());
    const indexed = await project.execute(ProjectItemCommand.of("item-1"));
    assert.ok(indexed >= 1);

    const search = new SemanticSearchUseCase(embedder, index);
    const results = await search.execute(SemanticSearchCommand.of("company-1", "refund"));
    assert.ok(results.length >= 1);
    assert.equal(results[0]!.itemId, "item-1");
    assert.equal(results[0]!.title, "Refund policy");
  });

  it("is a no-op for an unknown item", async () => {
    assert.equal(await project.execute(ProjectItemCommand.of("ghost")), 0);
  });

  it("is idempotent — reprojecting does not duplicate chunks", async () => {
    reader.add(publishedItem());
    await project.execute(ProjectItemCommand.of("item-1"));
    await project.execute(ProjectItemCommand.of("item-1"));

    const search = new SemanticSearchUseCase(embedder, index);
    const results = await search.execute(SemanticSearchCommand.of("company-1", "refund", null, null, null, 100));
    const seen = new Set(results.map((result) => result.itemId + ":" + String(result.chunkIndex)));
    assert.equal(seen.size, results.length);
  });
});

describe("DeprecateItemIndexUseCase", () => {
  it("keeps the item searchable but flags it stale", async () => {
    const reader = new FakePublishedItemReader();
    const embedder = new FakeEmbedder();
    const index = new FakeChunkIndexRepository();
    reader.add(publishedItem());
    await new ProjectItemUseCase(reader, embedder, index).execute(ProjectItemCommand.of("item-1"));

    await new DeprecateItemIndexUseCase(index).execute(DeprecateItemIndexCommand.of("company-1", "item-1"));

    const results = await new SemanticSearchUseCase(embedder, index).execute(
      SemanticSearchCommand.of("company-1", "refund"),
    );
    assert.ok(results.length >= 1);
    assert.equal(results[0]!.stale, true);
  });
});

describe("RemoveItemFromIndexUseCase", () => {
  it("removes an archived item from the index", async () => {
    const reader = new FakePublishedItemReader();
    const embedder = new FakeEmbedder();
    const index = new FakeChunkIndexRepository();
    reader.add(publishedItem());
    await new ProjectItemUseCase(reader, embedder, index).execute(ProjectItemCommand.of("item-1"));

    await new RemoveItemFromIndexUseCase(index).execute(RemoveItemFromIndexCommand.of("company-1", "item-1"));

    const results = await new SemanticSearchUseCase(embedder, index).execute(
      SemanticSearchCommand.of("company-1", "refund"),
    );
    assert.equal(results.length, 0);
  });
});

describe("RebuildIndexUseCase", () => {
  it("reprojects every served item for the tenant", async () => {
    const reader = new FakePublishedItemReader();
    const embedder = new FakeEmbedder();
    const index = new FakeChunkIndexRepository();
    reader.add(publishedItem({ itemId: "item-1", title: "Refund policy", body: "refund within 30 days" }));
    reader.add(publishedItem({ itemId: "item-2", title: "Shipping", body: "shipping takes five days" }));
    reader.add(publishedItem({ itemId: "other-co", companyId: "company-2", title: "x", body: "refund elsewhere" }));

    const project = new ProjectItemUseCase(reader, embedder, index);
    const rebuilt = await new RebuildIndexUseCase(reader, project).execute(RebuildIndexCommand.of("company-1"));
    assert.equal(rebuilt, 2);

    const results = await new SemanticSearchUseCase(embedder, index).execute(
      SemanticSearchCommand.of("company-1", "refund"),
    );
    assert.ok(results.some((result) => result.itemId === "item-1"));
    assert.ok(!results.some((result) => result.itemId === "other-co"));
  });
});

describe("SemanticSearchUseCase scope enforcement (ADR-022)", () => {
  let embedder: FakeEmbedder;
  let index: FakeChunkIndexRepository;

  beforeEach(async () => {
    const reader = new FakePublishedItemReader();
    embedder = new FakeEmbedder();
    index = new FakeChunkIndexRepository();
    reader.add(publishedItem({ itemId: "pub", sensitivity: "internal", collectionId: "col-1" }));
    reader.add(
      publishedItem({ itemId: "secret", sensitivity: "restricted", collectionId: "col-2", body: "refund secret" }),
    );
    const project = new ProjectItemUseCase(reader, embedder, index);
    await project.execute(ProjectItemCommand.of("pub"));
    await project.execute(ProjectItemCommand.of("secret"));
  });

  it("returns nothing for an empty query (fail-closed)", async () => {
    const results = await new SemanticSearchUseCase(embedder, index).execute(
      SemanticSearchCommand.of("company-1", "   "),
    );
    assert.equal(results.length, 0);
  });

  it("returns nothing for the wrong tenant", async () => {
    const results = await new SemanticSearchUseCase(embedder, index).execute(
      SemanticSearchCommand.of("company-999", "refund"),
    );
    assert.equal(results.length, 0);
  });

  it("respects a collection filter", async () => {
    const results = await new SemanticSearchUseCase(embedder, index).execute(
      SemanticSearchCommand.of("company-1", "refund", ["col-1"]),
    );
    assert.ok(results.every((result) => result.collectionId === "col-1"));
  });

  it("respects the sensitivity ceiling", async () => {
    const results = await new SemanticSearchUseCase(embedder, index).execute(
      SemanticSearchCommand.of("company-1", "refund", null, "internal"),
    );
    assert.ok(results.every((result) => result.sensitivity !== "restricted"));
  });
});
