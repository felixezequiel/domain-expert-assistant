import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Argon2idPasswordHasher } from "./Argon2idPasswordHasher.ts";

describe("Argon2idPasswordHasher", () => {
  const hasher = new Argon2idPasswordHasher();

  it("produces an argon2id hash that verifies for the right password", async () => {
    const hash = await hasher.hash("correct horse battery staple");

    assert.ok(hash.startsWith("$argon2id$"));
    assert.equal(await hasher.verify("correct horse battery staple", hash), true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hasher.hash("s3cret");

    assert.equal(await hasher.verify("wrong", hash), false);
  });

  it("returns false (never throws) for a malformed hash", async () => {
    assert.equal(await hasher.verify("whatever", "not-a-real-hash"), false);
  });

  it("salts so the same password yields different hashes", async () => {
    const first = await hasher.hash("same");
    const second = await hasher.hash("same");

    assert.notEqual(first, second);
  });
});
