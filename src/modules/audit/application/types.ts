/**
 * Audit read-model contracts (PRD-0). The Auditor persona reads, per tenant, what
 * happened: who did what, when, in which organization. Tenant isolation is enforced
 * fail-closed by the repository from the actor context (ADR-009) — privileged
 * operator/system events (companyId null) are captured but invisible to tenant auditors.
 */
export interface AuditEventView {
  readonly eventId: string;
  readonly eventName: string;
  readonly aggregateId: string;
  readonly occurredAt: string;
  readonly companyId: string | null;
  readonly actorId: string | null;
  readonly actorType: string | null;
  readonly causationId: string | null;
}

export interface AuditTrailFilter {
  readonly aggregateId: string | null;
  readonly actorId: string | null;
  readonly eventName: string | null;
  readonly from: Date | null;
  readonly to: Date | null;
  readonly limit: number;
}

export interface AuditTrailReadPort {
  findEvents(filter: AuditTrailFilter): Promise<ReadonlyArray<AuditEventView>>;
}
