import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { INGESTION_STATUSES, isIngestionStatus } from "./IngestionStatus.ts";

describe("IngestionStatus", () => {
  it("defines the four job states", () => {
    assert.deepEqual([...INGESTION_STATUSES], ["pending", "processing", "done", "failed"]);
  });

  it("recognises valid and rejects unknown states", () => {
    assert.equal(isIngestionStatus("processing"), true);
    assert.equal(isIngestionStatus("queued"), false);
  });
});
