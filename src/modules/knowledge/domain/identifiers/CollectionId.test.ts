import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CollectionId } from "./CollectionId.ts";

describe("CollectionId", () => {
  it("wraps a value and compares equal by value", () => {
    assert.equal(new CollectionId("col-1").value, "col-1");
    assert.ok(new CollectionId("col-1").equals(new CollectionId("col-1")));
  });
});
