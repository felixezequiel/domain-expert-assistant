export class TenantMismatchError extends Error {
  public readonly statusCode = 403;

  constructor() {
    super("Tenant mismatch: request companyId does not match authenticated user");
    this.name = "TenantMismatchError";
  }
}
