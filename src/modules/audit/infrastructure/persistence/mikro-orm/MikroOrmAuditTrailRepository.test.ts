import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EntityManager } from "@mikro-orm/core";
import type { EntityManagerProvider } from "../../../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import { MikroOrmAuditTrailRepository } from "./MikroOrmAuditTrailRepository.ts";
import type { AuditTrailFilter } from "../../../application/types.ts";

interface CapturedFind {
  where: Record<string, unknown>;
  options: { orderBy?: unknown; limit?: number };
}

function emProviderReturning(rows: ReadonlyArray<Record<string, unknown>>): {
  provider: EntityManagerProvider;
  captured: CapturedFind[];
} {
  const captured: CapturedFind[] = [];
  const em = {
    async find(_entity: unknown, where: Record<string, unknown>, options: CapturedFind["options"]) {
      captured.push({ where, options });
      return rows;
    },
  };
  const provider: EntityManagerProvider = {
    getEntityManager: () => em as unknown as EntityManager,
    setEntityManager: () => {},
    runWithScope: (cb) => cb(),
  };
  return { provider, captured };
}

const NO_FILTER: AuditTrailFilter = {
  aggregateId: null,
  actorId: null,
  eventName: null,
  from: null,
  to: null,
  limit: 100,
};

describe("MikroOrmAuditTrailRepository", () => {
  it("maps a system_events row to an AuditEventView", async () => {
    const { provider } = emProviderReturning([
      {
        id: "evt-1",
        eventName: "KnowledgeItemPublished",
        aggregateId: "item-1",
        occurredAt: "2026-06-16T10:00:00.000Z",
        companyId: "company-1",
        actorId: "user-1",
        actorType: "user",
        causationId: "cmd-1",
        payload: "{}",
      },
    ]);
    const repo = new MikroOrmAuditTrailRepository(provider);
    const [view] = await repo.findEvents(NO_FILTER);
    assert.deepEqual(view, {
      eventId: "evt-1",
      eventName: "KnowledgeItemPublished",
      aggregateId: "item-1",
      occurredAt: "2026-06-16T10:00:00.000Z",
      companyId: "company-1",
      actorId: "user-1",
      actorType: "user",
      causationId: "cmd-1",
    });
  });

  it("orders by occurredAt desc and applies the limit", async () => {
    const { provider, captured } = emProviderReturning([]);
    await new MikroOrmAuditTrailRepository(provider).findEvents({ ...NO_FILTER, limit: 25 });
    assert.deepEqual(captured[0]!.options.orderBy, { occurredAt: "desc" });
    assert.equal(captured[0]!.options.limit, 25);
  });

  it("AND-combines aggregate/actor/event filters into the where clause", async () => {
    const { provider, captured } = emProviderReturning([]);
    await new MikroOrmAuditTrailRepository(provider).findEvents({
      ...NO_FILTER,
      aggregateId: "item-9",
      actorId: "user-9",
      eventName: "KnowledgeItemArchived",
    });
    assert.deepEqual(captured[0]!.where, {
      aggregateId: "item-9",
      actorId: "user-9",
      eventName: "KnowledgeItemArchived",
    });
  });

  it("translates a from/to window into ISO range bounds on occurredAt", async () => {
    const { provider, captured } = emProviderReturning([]);
    await new MikroOrmAuditTrailRepository(provider).findEvents({
      ...NO_FILTER,
      from: new Date("2026-06-01T00:00:00.000Z"),
      to: new Date("2026-06-30T23:59:59.000Z"),
    });
    assert.deepEqual(captured[0]!.where.occurredAt, {
      $gte: "2026-06-01T00:00:00.000Z",
      $lte: "2026-06-30T23:59:59.000Z",
    });
  });

  it("omits the occurredAt clause entirely when no window is given", async () => {
    const { provider, captured } = emProviderReturning([]);
    await new MikroOrmAuditTrailRepository(provider).findEvents(NO_FILTER);
    assert.equal(captured[0]!.where.occurredAt, undefined);
  });
});
