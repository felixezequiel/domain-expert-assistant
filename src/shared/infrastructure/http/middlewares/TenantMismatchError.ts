import { DomainError } from "../../../domain/errors/DomainError.ts";

/**
 * Raised at the HTTP edge when the request's companyId does not match the authenticated
 * user's tenant. `kind` is "forbidden" so `toErrorResponse` (ADR-026) maps it to 403;
 * `statusCode` is retained because `HttpServer`'s legacy `HttpError` duck-typing reads it
 * directly — both serialization paths therefore keep the pre-ADR-026 403.
 */
export class TenantMismatchError extends DomainError {
  public readonly statusCode = 403;

  constructor() {
    super(
      "tenancy.requestMismatch",
      "forbidden",
      undefined,
      "Tenant mismatch: request companyId does not match authenticated user",
    );
    this.name = "TenantMismatchError";
  }
}
