import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { IngestionJobId } from "./IngestionJobId.ts";

describe("IngestionJobId", () => {
  it("wraps a value and compares equal by value", () => {
    assert.equal(new IngestionJobId("job-1").value, "job-1");
    assert.ok(new IngestionJobId("job-1").equals(new IngestionJobId("job-1")));
  });
});
