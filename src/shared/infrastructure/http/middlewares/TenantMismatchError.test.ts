import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TenantMismatchError } from "./TenantMismatchError.ts";
import { DomainError } from "../../../domain/errors/DomainError.ts";
import { toErrorResponse } from "../errorResponse.ts";

describe("TenantMismatchError", () => {
  it("is a DomainError carrying the stable code, forbidden kind and English fallback (ADR-026)", () => {
    const error = new TenantMismatchError();

    assert.ok(error instanceof DomainError);
    assert.equal(error.name, "TenantMismatchError");
    assert.equal(error.code, "tenancy.requestMismatch");
    assert.equal(error.kind, "forbidden");
    assert.equal(error.params, undefined);
    assert.equal(error.message, "Tenant mismatch: request companyId does not match authenticated user");
  });

  it("keeps the legacy statusCode field at 403 for HttpServer's HttpError duck-typing", () => {
    assert.equal(new TenantMismatchError().statusCode, 403);
  });

  it("serializes to a 403 with the code and English fallback via toErrorResponse", () => {
    const response = toErrorResponse(new TenantMismatchError());

    assert.equal(response.statusCode, 403);
    assert.equal(response.body.error, "tenancy.requestMismatch");
    assert.equal(
      response.body.message,
      "Tenant mismatch: request companyId does not match authenticated user",
    );
  });
});
