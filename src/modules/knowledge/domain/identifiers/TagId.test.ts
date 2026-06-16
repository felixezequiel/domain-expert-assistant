import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TagId } from "./TagId.ts";

describe("TagId", () => {
  it("wraps a value and compares equal by value", () => {
    assert.equal(new TagId("tag-1").value, "tag-1");
    assert.ok(new TagId("tag-1").equals(new TagId("tag-1")));
  });
});
