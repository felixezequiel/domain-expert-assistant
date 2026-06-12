import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GetUserByIdQuery } from "./GetUserByIdQuery.ts";

describe("GetUserByIdQuery", () => {
  it("should create a query from a primitive userId", () => {
    const query = GetUserByIdQuery.of("user-1");

    assert.equal(query.userId.value, "user-1");
  });

  it("should throw when userId is empty", () => {
    assert.throws(() => GetUserByIdQuery.of(""), { message: "Identifier value cannot be empty" });
  });
});
