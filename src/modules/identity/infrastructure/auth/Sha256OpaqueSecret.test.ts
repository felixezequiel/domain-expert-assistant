import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Sha256OpaqueSecret } from "./Sha256OpaqueSecret.ts";

describe("Sha256OpaqueSecret", () => {
  const secret = new Sha256OpaqueSecret();

  it("generates a prefixed token whose prefix leads the plaintext", () => {
    const generated = secret.generate();

    assert.ok(generated.prefix.length > 0);
    assert.ok(generated.plaintext.startsWith(generated.prefix + "."));
  });

  it("generates distinct tokens each call", () => {
    assert.notEqual(secret.generate().plaintext, secret.generate().plaintext);
  });

  it("verifies a token against its own hash and rejects others", () => {
    const generated = secret.generate();
    const hash = secret.hash(generated.plaintext);

    assert.equal(secret.verify(generated.plaintext, hash), true);
    assert.equal(secret.verify("tampered", hash), false);
  });

  it("hashes deterministically", () => {
    assert.equal(secret.hash("abc"), secret.hash("abc"));
  });

  it("returns false for a malformed stored hash instead of throwing", () => {
    assert.equal(secret.verify("abc", "zzz"), false);
  });
});
