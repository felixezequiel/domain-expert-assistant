import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ListAuditTrailQuery, DEFAULT_AUDIT_LIMIT, MAX_AUDIT_LIMIT } from "./ListAuditTrailQuery.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

describe("ListAuditTrailQuery", () => {
  it("defaults all filters to null and uses the default limit", () => {
    const query = ListAuditTrailQuery.of();

    assert.equal(query.filter.aggregateId, null);
    assert.equal(query.filter.actorId, null);
    assert.equal(query.filter.eventName, null);
    assert.equal(query.filter.from, null);
    assert.equal(query.filter.to, null);
    assert.equal(query.filter.limit, DEFAULT_AUDIT_LIMIT);
  });

  it("builds the filter from primitives", () => {
    const query = ListAuditTrailQuery.of({
      aggregateId: "agg-1",
      actorId: "user-1",
      eventName: "KnowledgePublished",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-12-31T00:00:00.000Z",
      limit: 25,
    });

    assert.equal(query.filter.aggregateId, "agg-1");
    assert.equal(query.filter.actorId, "user-1");
    assert.equal(query.filter.eventName, "KnowledgePublished");
    assert.equal(query.filter.from?.toISOString(), "2026-01-01T00:00:00.000Z");
    assert.equal(query.filter.to?.toISOString(), "2026-12-31T00:00:00.000Z");
    assert.equal(query.filter.limit, 25);
  });

  it("clamps a limit above the maximum", () => {
    const query = ListAuditTrailQuery.of({ limit: MAX_AUDIT_LIMIT + 5000 });

    assert.equal(query.filter.limit, MAX_AUDIT_LIMIT);
  });

  it("falls back to the default limit for non-positive values", () => {
    assert.equal(ListAuditTrailQuery.of({ limit: 0 }).filter.limit, DEFAULT_AUDIT_LIMIT);
    assert.equal(ListAuditTrailQuery.of({ limit: -3 }).filter.limit, DEFAULT_AUDIT_LIMIT);
  });

  it("rejects an unparseable date with a coded validation error", () => {
    assert.throws(
      () => ListAuditTrailQuery.of({ from: "not-a-date" }),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, "audit.invalidDate");
        assert.equal(error.kind, "validation");
        assert.deepEqual(error.params, { value: "not-a-date" });
        assert.equal(error.message, "Invalid date in audit trail query: not-a-date");
        return true;
      },
    );
  });
});
