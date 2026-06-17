import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ListAuditTrailUseCase } from "./ListAuditTrailUseCase.ts";
import { ListAuditTrailQuery } from "../query/ListAuditTrailQuery.ts";
import type { AuditEventRecord, AuditTrailFilter, AuditTrailReadPort } from "../types.ts";
import type { UserDirectoryPort } from "../../../../shared/ports/UserDirectoryPort.ts";

class StubReadPort implements AuditTrailReadPort {
  public receivedFilter: AuditTrailFilter | null = null;
  constructor(private readonly toReturn: ReadonlyArray<AuditEventRecord>) {}

  public async findEvents(filter: AuditTrailFilter): Promise<ReadonlyArray<AuditEventRecord>> {
    this.receivedFilter = filter;
    return this.toReturn;
  }
}

class StubUserDirectory implements UserDirectoryPort {
  constructor(private readonly names: Record<string, string> = {}) {}
  public async resolveDisplayNames(
    userIds: ReadonlyArray<string>,
  ): Promise<ReadonlyMap<string, string>> {
    const resolved = new Map<string, string>();
    for (const userId of userIds) {
      const name = this.names[userId];
      if (name !== undefined) {
        resolved.set(userId, name);
      }
    }
    return resolved;
  }
}

const SAMPLE_RECORD: AuditEventRecord = {
  eventId: "e1",
  eventName: "Sample",
  aggregateId: "agg-1",
  occurredAt: "2026-06-16T00:00:00.000Z",
  companyId: "company-1",
  actorId: "user-1",
  actorType: "user",
  causationId: null,
};

describe("ListAuditTrailUseCase", () => {
  it("forwards the query filter to the read port and resolves the actor's display name", async () => {
    const port = new StubReadPort([SAMPLE_RECORD]);
    const useCase = new ListAuditTrailUseCase(port, new StubUserDirectory({ "user-1": "Ada Lovelace" }));

    const result = await useCase.execute(ListAuditTrailQuery.of({ aggregateId: "agg-1" }));

    assert.equal(port.receivedFilter?.aggregateId, "agg-1");
    assert.deepEqual([...result], [{ ...SAMPLE_RECORD, actorName: "Ada Lovelace" }]);
  });

  it("leaves actorName null for a system actor or an unresolved id (UI falls back to the id)", async () => {
    const systemRecord: AuditEventRecord = { ...SAMPLE_RECORD, eventId: "e2", actorId: null };
    const port = new StubReadPort([SAMPLE_RECORD, systemRecord]);
    const useCase = new ListAuditTrailUseCase(port, new StubUserDirectory());

    const result = await useCase.execute(ListAuditTrailQuery.of());

    assert.equal(result[0]!.actorName, null);
    assert.equal(result[1]!.actorName, null);
  });
});
