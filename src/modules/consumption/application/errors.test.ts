import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DomainError } from "../../../shared/domain/errors/DomainError.ts";
import { ScopeViolationError, RateLimitExceededError } from "./errors.ts";

describe("ScopeViolationError", () => {
  it("carries the stable code, forbidden kind, collectionId param, and verbatim message", () => {
    const error = new ScopeViolationError("col-x");
    assert.ok(error instanceof DomainError);
    assert.equal(error.code, "consumption.scopeViolation");
    assert.equal(error.kind, "forbidden");
    assert.deepEqual(error.params, { collectionId: "col-x" });
    assert.equal(
      error.message,
      "Scope violation: collection 'col-x' is outside the credential's allowed scope.",
    );
    assert.equal(error.collectionId, "col-x");
  });
});

describe("RateLimitExceededError", () => {
  it("carries the stable code, rate_limited kind, retryAfterSeconds param, and verbatim message", () => {
    const error = new RateLimitExceededError(30);
    assert.ok(error instanceof DomainError);
    assert.equal(error.code, "consumption.rateLimitExceeded");
    assert.equal(error.kind, "rate_limited");
    assert.deepEqual(error.params, { retryAfterSeconds: 30 });
    assert.equal(error.message, "Rate limit exceeded. Retry after 30 seconds.");
    assert.equal(error.retryAfterSeconds, 30);
  });
});
