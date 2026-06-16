import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LIFECYCLE_STATUSES, isLifecycleStatus } from "./LifecycleStatus.ts";

describe("LifecycleStatus", () => {
  it("defines the five lifecycle states", () => {
    assert.deepEqual([...LIFECYCLE_STATUSES], ["draft", "in_review", "published", "deprecated", "archived"]);
  });

  it("recognises valid and rejects unknown states", () => {
    assert.equal(isLifecycleStatus("published"), true);
    assert.equal(isLifecycleStatus("retired"), false);
  });
});
