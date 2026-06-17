import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DomainError } from "../../domain/errors/DomainError.ts";
import { httpStatusForKind, toErrorResponse } from "./errorResponse.ts";

describe("errorResponse", () => {
  it("maps every kind to its HTTP status", () => {
    assert.equal(httpStatusForKind("validation"), 400);
    assert.equal(httpStatusForKind("unauthorized"), 401);
    assert.equal(httpStatusForKind("forbidden"), 403);
    assert.equal(httpStatusForKind("not_found"), 404);
    assert.equal(httpStatusForKind("conflict"), 409);
    assert.equal(httpStatusForKind("rate_limited"), 429);
    assert.equal(httpStatusForKind("unavailable"), 503);
    assert.equal(httpStatusForKind("internal"), 500);
  });

  it("serializes a DomainError to { error: code, message, params } at the kind's status", () => {
    const result = toErrorResponse(
      new DomainError("knowledge.itemNotFound", "not_found", { id: "abc" }, "Knowledge item not found: abc"),
    );
    assert.equal(result.statusCode, 404);
    assert.deepEqual(result.body, {
      error: "knowledge.itemNotFound",
      message: "Knowledge item not found: abc",
      params: { id: "abc" },
    });
  });

  it("omits params when there are none", () => {
    const result = toErrorResponse(new DomainError("identity.invalidCredentials", "unauthorized"));
    assert.equal(result.statusCode, 401);
    assert.equal("params" in result.body, false);
  });

  it("falls back to common.unexpected (500) for a non-domain error", () => {
    const result = toErrorResponse(new Error("boom"));
    assert.equal(result.statusCode, 500);
    assert.equal(result.body.error, "common.unexpected");
    assert.equal(result.body.message, "boom");
  });
});
