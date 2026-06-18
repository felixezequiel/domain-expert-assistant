/**
 * Audit read-model contracts (PRD-0). The Auditor persona reads, per tenant, what
 * happened: who did what, when, in which organization. Tenant isolation is enforced
 * fail-closed by the repository from the actor context (ADR-009) — privileged
 * operator/system events (companyId null) are captured but invisible to tenant auditors.
 */
/**
 * An event exactly as the read port returns it from the event store (the raw envelope).
 * `payload` is the deserialized domain event the store persisted (`JSON.stringify(event)`),
 * so the Auditor surface can render *what* happened — the event's own fields — not just the
 * envelope. It is `{}` when the stored JSON is somehow unparseable (never expected, but the
 * read model must not throw on a single bad row).
 */
export interface AuditEventRecord {
  readonly eventId: string;
  readonly eventName: string;
  readonly aggregateId: string;
  readonly occurredAt: string;
  readonly companyId: string | null;
  readonly actorId: string | null;
  readonly actorType: string | null;
  readonly causationId: string | null;
  readonly payload: Record<string, unknown>;
}

/**
 * What the audit trail use case serves: the raw event plus the actor's resolved display
 * name (`actorName`). The aggregate stays a bare id — for a forensic trail the stable
 * identifier is the right key, and aggregates are heterogeneous (item, user, credential…),
 * so we resolve the human "who" (the actor) but not the "what". `actorName` is null when it
 * cannot be resolved (a system/operator actor, or another tenant), so the UI falls back to
 * the id.
 */
export interface AuditEventView extends AuditEventRecord {
  readonly actorName: string | null;
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
  findEvents(filter: AuditTrailFilter): Promise<ReadonlyArray<AuditEventRecord>>;
}
