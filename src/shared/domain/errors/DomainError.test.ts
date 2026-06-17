import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DomainError } from "./DomainError.ts";

describe("DomainError", () => {
  it("carries a stable code, kind and params, with message defaulting to the code", () => {
    const error = new DomainError("knowledge.collectionNameExists", "conflict", { name: "Runbooks" });

    assert.equal(error.code, "knowledge.collectionNameExists");
    assert.equal(error.kind, "conflict");
    assert.deepEqual(error.params, { name: "Runbooks" });
    assert.equal(error.message, "knowledge.collectionNameExists");
    assert.ok(error instanceof Error);
  });

  it("keeps an explicit English message as the fallback and leaves params undefined", () => {
    const error = new DomainError("identity.invalidCredentials", "unauthorized", undefined, "Invalid credentials");

    assert.equal(error.message, "Invalid credentials");
    assert.equal(error.params, undefined);
  });
});
