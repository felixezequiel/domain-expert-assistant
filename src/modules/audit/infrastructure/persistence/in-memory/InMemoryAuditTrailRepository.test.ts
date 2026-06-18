import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { InMemoryAuditTrailRepository } from "./InMemoryAuditTrailRepository.ts";
import { ListAuditTrailQuery } from "../../../application/query/ListAuditTrailQuery.ts";
import type { AuditEventRecord } from "../../../application/types.ts";
import { runWithActor } from "../../../../../shared/application/context/ActorContext.ts";
import { MissingTenantContextError } from "../../../../../shared/application/tenancy/TenantScopeResolution.ts";

function view(overrides: Partial<AuditEventRecord>): AuditEventRecord {
  return {
    eventId: "e",
    eventName: "Sample",
    aggregateId: "agg",
    occurredAt: "2026-06-16T12:00:00.000Z",
    companyId: "company-A",
    actorId: "user-1",
    actorType: "user",
    causationId: null,
    payload: {},
    ...overrides,
  };
}

function repoWith(events: ReadonlyArray<AuditEventRecord>): InMemoryAuditTrailRepository {
  const repo = new InMemoryAuditTrailRepository();
  for (const event of events) {
    repo.seed(event);
  }
  return repo;
}

const TENANT_A = { companyId: "company-A", actorId: "u", actorType: "user" as const };
const OPERATOR = { companyId: null, actorId: "op", actorType: "operator" as const };

describe("InMemoryAuditTrailRepository", () => {
  it("returns only the tenant's own events under a tenant scope", async () => {
    const repo = repoWith([
      view({ eventId: "a1", companyId: "company-A" }),
      view({ eventId: "b1", companyId: "company-B" }),
    ]);

    const result = await runWithActor(TENANT_A, () =>
      repo.findEvents(ListAuditTrailQuery.of().filter),
    );

    assert.equal(result.length, 1);
    assert.equal(result[0]!.eventId, "a1");
  });

  it("hides privileged (company-null) events from a tenant auditor", async () => {
    const repo = repoWith([
      view({ eventId: "a1", companyId: "company-A" }),
      view({ eventId: "op1", companyId: null, actorType: "operator" }),
    ]);

    const result = await runWithActor(TENANT_A, () =>
      repo.findEvents(ListAuditTrailQuery.of().filter),
    );

    assert.deepEqual(
      result.map((event) => event.eventId),
      ["a1"],
    );
  });

  it("lets a privileged operator see every tenant's events plus operator events", async () => {
    const repo = repoWith([
      view({ eventId: "a1", companyId: "company-A" }),
      view({ eventId: "b1", companyId: "company-B" }),
      view({ eventId: "op1", companyId: null }),
    ]);

    const result = await runWithActor(OPERATOR, () =>
      repo.findEvents(ListAuditTrailQuery.of().filter),
    );

    assert.equal(result.length, 3);
  });

  it("fails closed when there is no actor scope", async () => {
    const repo = repoWith([view({})]);

    await assert.rejects(
      () => repo.findEvents(ListAuditTrailQuery.of().filter),
      MissingTenantContextError,
    );
  });

  it("applies aggregate, actor, eventName and time filters within the tenant", async () => {
    const repo = repoWith([
      view({ eventId: "keep", aggregateId: "agg-1", eventName: "X", occurredAt: "2026-06-10T00:00:00.000Z" }),
      view({ eventId: "wrongAgg", aggregateId: "agg-2", eventName: "X", occurredAt: "2026-06-10T00:00:00.000Z" }),
      view({ eventId: "wrongName", aggregateId: "agg-1", eventName: "Y", occurredAt: "2026-06-10T00:00:00.000Z" }),
      view({ eventId: "tooEarly", aggregateId: "agg-1", eventName: "X", occurredAt: "2026-01-01T00:00:00.000Z" }),
    ]);

    const query = ListAuditTrailQuery.of({
      aggregateId: "agg-1",
      eventName: "X",
      from: "2026-06-01T00:00:00.000Z",
    });

    const result = await runWithActor(TENANT_A, () => repo.findEvents(query.filter));

    assert.deepEqual(
      result.map((event) => event.eventId),
      ["keep"],
    );
  });

  it("caps the number of results at the query limit", async () => {
    const repo = repoWith([
      view({ eventId: "1" }),
      view({ eventId: "2" }),
      view({ eventId: "3" }),
    ]);

    const result = await runWithActor(TENANT_A, () =>
      repo.findEvents(ListAuditTrailQuery.of({ limit: 2 }).filter),
    );

    assert.equal(result.length, 2);
  });
});
