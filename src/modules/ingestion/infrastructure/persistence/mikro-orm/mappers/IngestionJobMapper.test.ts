import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { IngestionJobMapper } from "./IngestionJobMapper.ts";
import { IngestionJob } from "../../../../domain/aggregates/IngestionJob.ts";
import { IngestionJobId } from "../../../../domain/identifiers/IngestionJobId.ts";
import { MimeType } from "../../../../domain/valueObjects/MimeType.ts";

describe("IngestionJobMapper", () => {
  it("round-trips a job through the ORM entity", () => {
    const original = IngestionJob.reconstitute({
      id: new IngestionJobId("j1"),
      companyId: "company-1",
      collectionId: "col-1",
      filename: "policy.md",
      mimeType: new MimeType("text/markdown"),
      storageRef: "company-1/j1",
      status: "done",
      createdItemId: "item-1",
      failureReason: null,
      createdBy: "curator-1",
      createdAt: new Date("2026-06-16T00:00:00.000Z"),
    });

    const domain = IngestionJobMapper.toDomain(IngestionJobMapper.toOrmEntity(original));

    assert.equal(domain.id.value, "j1");
    assert.equal(domain.companyId, "company-1");
    assert.equal(domain.mimeType.value, "text/markdown");
    assert.equal(domain.status, "done");
    assert.equal(domain.createdItemId, "item-1");
    assert.equal(domain.createdAt.toISOString(), "2026-06-16T00:00:00.000Z");
  });
});
