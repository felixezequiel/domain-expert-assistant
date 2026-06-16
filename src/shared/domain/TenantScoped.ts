/**
 * Contract for tenant-scoped aggregates (ADR-008 / ADR-009).
 *
 * Every aggregate that belongs to a tenant exposes its `companyId` through this
 * shared-kernel contract. The application layer reads it generically to run the
 * fail-closed cross-check (`aggregate.companyId === actor context`) before stamping
 * and persisting — the single requirement a tenant-scoped domain must satisfy.
 *
 * The domain stays free of identity/tenancy plumbing: it only declares ownership.
 */
export interface TenantScoped {
  readonly companyId: string;
}

export function isTenantScoped(candidate: unknown): candidate is TenantScoped {
  return (
    candidate !== null &&
    typeof candidate === "object" &&
    typeof (candidate as { companyId?: unknown }).companyId === "string"
  );
}
