import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { MikroORM } from "@mikro-orm/postgresql";
import type { EntityManager } from "@mikro-orm/core";
import mikroOrmConfig from "../../../mikro-orm.config.ts";
import { MikroOrmChunkIndexRepository } from "../infrastructure/persistence/mikro-orm/repositories/MikroOrmChunkIndexRepository.ts";
import type { EntityManagerProvider } from "../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import type { ChunkItemMetadata, RetrievalScope } from "../application/types.ts";

/**
 * Golden-set relevance check (PRD-4 §10): the acceptance bar that RRF hybrid fusion ranks a
 * known-relevant document ABOVE what vector-only OR lexical-only retrieval would rank first.
 *
 * Deterministic by construction — no BGE model. The query embedding and every chunk embedding
 * are hand-built so each signal's ranking is fixed:
 *   - the "vector winner" V is closest to the query vector but lacks the query term (so it is
 *     absent from the lexical list);
 *   - the "lexical winner" L is the strongest text match but its vector is the farthest;
 *   - the "hybrid winner" H is 2nd on BOTH signals.
 * RRF sums the per-list contributions, so H (good on both) beats V (one strong signal, absent
 * from the other list) and L (one strong signal, a weak vector contribution). This exercises
 * the real fusion SQL in MikroOrmChunkIndexRepository against Postgres + pgvector.
 *
 * Runs against the docker Postgres (the project's only engine, ADR-018). If the database is
 * unreachable the suite skips rather than fails, keeping the rest of the unit suite hermetic.
 */
const EMBEDDING_DIMENSIONS = 1024;
const QUERY_AXIS = 0;
const COMPANY_ID = "hybrid-relevance-itest";

// Builds a unit vector whose angle to the query axis is `angleRadians`: a `cos` component on the
// shared query axis plus a `sin` component on a private axis. Cosine similarity to the query is
// exactly cos(angle), so a smaller angle is a closer (better-ranked) vector — fully deterministic.
function vectorAtAngle(angleRadians: number, privateAxis: number): Array<number> {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  vector[QUERY_AXIS] = Math.cos(angleRadians);
  vector[privateAxis] = Math.sin(angleRadians);
  return vector;
}

function queryVector(): Array<number> {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  vector[QUERY_AXIS] = 1;
  return vector;
}

function metadata(): ChunkItemMetadata {
  return {
    companyId: COMPANY_ID,
    collectionId: "col-1",
    sensitivity: "public",
    title: "doc",
    tagIds: [],
    publishedVersion: 1,
    publishedAt: "2026-06-17T00:00:00.000Z",
    stale: false,
  };
}

function providerFor(entityManager: EntityManager): EntityManagerProvider {
  return {
    getEntityManager: () => entityManager,
    setEntityManager: () => {},
    runWithScope: <T>(callback: () => Promise<T>) => callback(),
  };
}

interface RankedRow {
  readonly item_id: string;
}

describe("Hybrid search relevance (golden set, PRD-4 §10)", () => {
  let orm: MikroORM | null = null;
  let entityManager: EntityManager;
  let repo: MikroOrmChunkIndexRepository;

  before(async () => {
    try {
      orm = await MikroORM.init(mikroOrmConfig);
      await orm.migrator.up();
    } catch (error) {
      // No database available (e.g. CI without docker): skip the whole suite, do not fail.
      orm = null;
      return;
    }
    entityManager = orm.em.fork();
    repo = new MikroOrmChunkIndexRepository(providerFor(entityManager));

    const raw = entityManager as unknown as { execute(sql: string, params?: ReadonlyArray<unknown>): Promise<unknown> };
    await raw.execute("DELETE FROM chunks WHERE company_id = ?", [COMPANY_ID]);

    // The query term is "refund". V omits it (vector-only); L repeats it heavily (lexical #1);
    // H mentions it once (lexical #2). Angles fix the vector order — V and H are closest, then
    // three term-less fillers, then L last. Pushing L to a poor vector rank shrinks its vector
    // RRF contribution so the cross-signal H (2nd on BOTH lists) is the clear fused winner; with
    // too few docs the fusion would tie (L's lexical-#1 nearly cancels H's edge).
    const documents = [
      { itemId: "vector-winner", angle: 0.05, axis: 1, content: "warranty terms and shipping windows" },
      { itemId: "hybrid-winner", angle: 0.1, axis: 2, content: "our refund process explained for customers" },
      { itemId: "filler-1", angle: 0.4, axis: 3, content: "office locations and opening hours" },
      { itemId: "filler-2", angle: 0.6, axis: 4, content: "team structure and reporting lines" },
      { itemId: "filler-3", angle: 0.8, axis: 5, content: "expense reporting and travel booking" },
      { itemId: "lexical-winner", angle: 1.4, axis: 6, content: "refund refund refund refund refund refund" },
    ];
    for (const document of documents) {
      await repo.replaceItemChunks(
        document.itemId,
        [{ chunkIndex: 0, content: document.content, embedding: vectorAtAngle(document.angle, document.axis) }],
        metadata(),
      );
    }
  });

  after(async () => {
    if (orm !== null) {
      const raw = entityManager as unknown as { execute(sql: string, params?: ReadonlyArray<unknown>): Promise<unknown> };
      await raw.execute("DELETE FROM chunks WHERE company_id = ?", [COMPANY_ID]);
      await orm.close(true);
    }
  });

  it("ranks the hybrid-relevant doc #1, above the vector-only and lexical-only winners", async (testContext) => {
    if (orm === null) {
      testContext.skip("Postgres is not reachable; skipping the golden-set relevance check");
      return;
    }

    const scope: RetrievalScope = {
      companyId: COMPANY_ID,
      collectionIds: null,
      sensitivityCeiling: null,
      tagIds: null,
    };
    const hybrid = await repo.search(queryVector(), "refund", scope, 10);

    // Baselines computed test-side over the SAME corpus to prove neither single signal alone
    // would surface the hybrid winner first.
    const raw = entityManager as unknown as {
      execute(sql: string, params?: ReadonlyArray<unknown>): Promise<Array<RankedRow>>;
    };
    const vectorOnly = await raw.execute(
      "SELECT item_id FROM chunks WHERE company_id = ? ORDER BY embedding <=> ?::vector LIMIT 1",
      [COMPANY_ID, "[" + queryVector().join(",") + "]"],
    );
    const lexicalOnly = await raw.execute(
      "SELECT item_id FROM chunks WHERE company_id = ? " +
        "AND content_tsv @@ websearch_to_tsquery('simple', ?) " +
        "ORDER BY ts_rank(content_tsv, websearch_to_tsquery('simple', ?)) DESC LIMIT 1",
      [COMPANY_ID, "refund", "refund"],
    );

    assert.equal(hybrid[0]!.itemId, "hybrid-winner", "RRF hybrid must rank the cross-signal doc #1");
    assert.equal(vectorOnly[0]!.item_id, "vector-winner", "vector-only would rank a different doc #1");
    assert.equal(lexicalOnly[0]!.item_id, "lexical-winner", "lexical-only would rank a different doc #1");
    assert.notEqual(hybrid[0]!.itemId, vectorOnly[0]!.item_id);
    assert.notEqual(hybrid[0]!.itemId, lexicalOnly[0]!.item_id);
  });
});
