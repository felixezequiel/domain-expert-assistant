import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ListAuditTrailUseCase } from "./ListAuditTrailUseCase.ts";
import { ListAuditTrailQuery } from "../query/ListAuditTrailQuery.ts";
import type { AuditEventView, AuditTrailFilter, AuditTrailReadPort } from "../types.ts";

class StubReadPort implements AuditTrailReadPort {
  public receivedFilter: AuditTrailFilter | null = null;
  constructor(private readonly toReturn: ReadonlyArray<AuditEventView>) {}

  public async findEvents(filter: AuditTrailFilter): Promise<ReadonlyArray<AuditEventView>> {
    this.receivedFilter = filter;
    return this.toReturn;
  }
}

const SAMPLE_VIEW: AuditEventView = {
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
  it("forwards the query filter to the read port and returns its result", async () => {
    const port = new StubReadPort([SAMPLE_VIEW]);
    const useCase = new ListAuditTrailUseCase(port);

    const result = await useCase.execute(ListAuditTrailQuery.of({ aggregateId: "agg-1" }));

    assert.equal(port.receivedFilter?.aggregateId, "agg-1");
    assert.deepEqual([...result], [SAMPLE_VIEW]);
  });
});
