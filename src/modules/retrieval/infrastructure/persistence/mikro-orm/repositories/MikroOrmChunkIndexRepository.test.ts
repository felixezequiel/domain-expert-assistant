import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EntityManager } from "@mikro-orm/core";
import type { EntityManagerProvider } from "../../../../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import { MikroOrmChunkIndexRepository } from "./MikroOrmChunkIndexRepository.ts";
import type { ChunkItemMetadata, RetrievalScope } from "../../../../application/types.ts";

interface Executed {
  readonly sql: string;
  readonly params: ReadonlyArray<unknown>;
}

/**
 * Records the raw SQL + params the repository issues (the real query is exercised against
 * Postgres in the integration check). `search` returns a single canned row so the mapper runs.
 */
class RecordingEntityManager {
  public readonly executed: Array<Executed> = [];
  public async execute(sql: string, params: ReadonlyArray<unknown>): Promise<unknown> {
    this.executed.push({ sql, params });
    if (sql.includes("WITH scoped")) {
      return [
        {
          item_id: "item-1",
          title: "Refund policy",
          collection_id: "col-1",
          sensitivity: "internal",
          chunk_index: 0,
          content: "refund within 30 days",
          score: "0.0328",
          published_at: "2026-06-16T00:00:00.000Z",
          stale: false,
        },
      ];
    }
    return [];
  }
}

function providerFor(entityManager: RecordingEntityManager): EntityManagerProvider {
  return {
    getEntityManager: () => entityManager as unknown as EntityManager,
    setEntityManager: () => {},
    runWithScope: <T>(callback: () => Promise<T>) => callback(),
  };
}

const META: ChunkItemMetadata = {
  companyId: "company-1",
  collectionId: "col-1",
  sensitivity: "internal",
  title: "Refund policy",
  publishedVersion: 1,
  publishedAt: "2026-06-16T00:00:00.000Z",
  stale: false,
};

describe("MikroOrmChunkIndexRepository", () => {
  it("replaceItemChunks deletes the item then inserts each chunk as a vector", async () => {
    const entityManager = new RecordingEntityManager();
    const repo = new MikroOrmChunkIndexRepository(providerFor(entityManager));

    await repo.replaceItemChunks(
      "item-1",
      [
        { chunkIndex: 0, content: "a", embedding: [0.1, 0.2] },
        { chunkIndex: 1, content: "b", embedding: [0.3, 0.4] },
      ],
      META,
    );

    assert.ok(entityManager.executed[0]!.sql.startsWith("DELETE FROM chunks"));
    assert.deepEqual(entityManager.executed[0]!.params, ["company-1", "item-1"]);
    assert.equal(entityManager.executed.length, 3);
    assert.ok(entityManager.executed[1]!.sql.includes("?::vector"));
    assert.ok(entityManager.executed[1]!.params.includes("[0.1,0.2]"));
  });

  it("removeItem and markItemStale scope by company + item", async () => {
    const entityManager = new RecordingEntityManager();
    const repo = new MikroOrmChunkIndexRepository(providerFor(entityManager));

    await repo.removeItem("company-1", "item-1");
    await repo.markItemStale("company-1", "item-2");

    assert.ok(entityManager.executed[0]!.sql.startsWith("DELETE FROM chunks"));
    assert.deepEqual(entityManager.executed[0]!.params, ["company-1", "item-1"]);
    assert.ok(entityManager.executed[1]!.sql.startsWith("UPDATE chunks SET stale = TRUE"));
    assert.deepEqual(entityManager.executed[1]!.params, ["company-1", "item-2"]);
  });

  it("search filters by company first and fuses with RRF", async () => {
    const entityManager = new RecordingEntityManager();
    const repo = new MikroOrmChunkIndexRepository(providerFor(entityManager));
    const scope: RetrievalScope = { companyId: "company-1", collectionIds: null, sensitivityCeiling: null };

    const results = await repo.search([0.1, 0.2], "refund", scope, 10);

    const query = entityManager.executed[0]!;
    assert.ok(query.sql.includes("WHERE company_id = ?"));
    assert.ok(query.sql.includes("websearch_to_tsquery"));
    assert.ok(query.sql.includes("embedding <=> ?::vector"));
    assert.equal(query.params[0], "company-1");
    assert.ok(query.params.includes(60), "RRF k constant must be bound");
    assert.equal(results.length, 1);
    assert.equal(results[0]!.itemId, "item-1");
    assert.equal(results[0]!.score, 0.0328);
  });

  it("search with an empty collection scope short-circuits to no rows (fail-closed)", async () => {
    const entityManager = new RecordingEntityManager();
    const repo = new MikroOrmChunkIndexRepository(providerFor(entityManager));
    const scope: RetrievalScope = { companyId: "company-1", collectionIds: [], sensitivityCeiling: null };

    await repo.search([0.1], "refund", scope, 10);

    assert.ok(entityManager.executed[0]!.sql.includes("AND FALSE"));
  });

  it("search applies collection and sensitivity pre-filters (ADR-022)", async () => {
    const entityManager = new RecordingEntityManager();
    const repo = new MikroOrmChunkIndexRepository(providerFor(entityManager));
    const scope: RetrievalScope = {
      companyId: "company-1",
      collectionIds: ["col-1", "col-2"],
      sensitivityCeiling: "internal",
    };

    await repo.search([0.1], "refund", scope, 10);

    const query = entityManager.executed[0]!;
    assert.ok(query.sql.includes("collection_id IN (?, ?)"));
    assert.ok(query.sql.includes("array_position"));
    assert.ok(query.params.includes("col-1"));
    assert.ok(query.params.includes("col-2"));
    assert.ok(query.params.includes("internal"));
  });
});
