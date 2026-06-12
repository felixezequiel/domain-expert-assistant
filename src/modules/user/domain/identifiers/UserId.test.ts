import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UserId } from "./UserId.ts";

describe("UserId", () => {
  it("should create a UserId with a given value", () => {
    const userId = new UserId("user-abc-123");

    assert.equal(userId.value, "user-abc-123");
  });

  it("should generate a unique value when no value is provided", () => {
    const userId = new UserId();

    assert.ok(userId.value.length > 0);
  });

  it("should be equal to another UserId with the same value", () => {
    const firstId = new UserId("same");
    const secondId = new UserId("same");

    assert.ok(firstId.equals(secondId));
  });

  it("should not be equal to a different UserId", () => {
    const firstId = new UserId("a");
    const secondId = new UserId("b");

    assert.ok(!firstId.equals(secondId));
  });
});
