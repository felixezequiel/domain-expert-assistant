import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UserId } from "./UserId.ts";

describe("UserId", () => {
  it("wraps a value and compares equal by value", () => {
    assert.equal(new UserId("user-1").value, "user-1");
    assert.ok(new UserId("user-1").equals(new UserId("user-1")));
    assert.ok(!new UserId("user-1").equals(new UserId("user-2")));
  });
});
