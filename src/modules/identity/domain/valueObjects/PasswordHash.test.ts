import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PasswordHash } from "./PasswordHash.ts";

describe("PasswordHash", () => {
  it("wraps a non-empty hash string", () => {
    assert.equal(new PasswordHash("$argon2id$v=19$...").value, "$argon2id$v=19$...");
  });

  it("rejects an empty hash", () => {
    assert.throws(() => new PasswordHash(""), /Password hash/);
  });
});
