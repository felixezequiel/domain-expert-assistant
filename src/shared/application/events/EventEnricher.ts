import type { DomainEvent } from "../../domain/events/DomainEvent.ts";
import type { ActorType } from "../../domain/events/ActorType.ts";
import type { AggregateRoot } from "../../domain/aggregates/AggregateRoot.ts";
import type { Identifier } from "../../domain/identifiers/Identifier.ts";
import { isTenantScoped } from "../../domain/TenantScoped.ts";
import { isPrivilegedActorType, type Actor } from "../context/ActorContext.ts";
import { DomainError } from "../../domain/errors/DomainError.ts";

/**
 * Raised when an event originated from a tenant-scoped aggregate whose `companyId`
 * does not match the actor context tenant (ADR-008). This is the write-path defence
 * the MikroORM read filter cannot provide: it turns a silent cross-tenant write into
 * a deterministic abort before anything is persisted.
 *
 * `kind` is "internal" to preserve the pre-ADR-026 status: this error never matched
 * the edges' substring `statusForError`, so it always became a 500 and no test pinned
 * a different status. The main agent should decide whether a cross-tenant write should
 * instead be a 403 (ADR-026 §3 discrepancy note).
 */
export class EnvelopeTenantMismatchError extends DomainError {
  constructor(aggregateId: string, aggregateCompanyId: string, contextCompanyId: string | null) {
    super(
      "tenancy.envelopeMismatch",
      "internal",
      {
        aggregateId,
        aggregateCompanyId,
        contextCompanyId: contextCompanyId ?? "none",
      },
      `Cross-tenant write blocked: aggregate ${aggregateId} belongs to company ` +
        `${aggregateCompanyId} but the actor context tenant is ${contextCompanyId ?? "none"}.`,
    );
    this.name = "EnvelopeTenantMismatchError";
  }
}

interface StampableEnvelope {
  companyId: string | null;
  actorId: string | null;
  actorType: ActorType | null;
}

/**
 * Enriches drained events with the actor envelope and runs the fail-closed cross-check
 * (ADR-008). Runs in the application pipeline between drain and dispatch so in-process
 * handlers and persisted events see the same complete envelope.
 *
 * For every event sourced from a tracked tenant-scoped aggregate, the aggregate's
 * `companyId` must equal the context tenant before stamping; a mismatch (including a
 * tenant aggregate touched with no tenant in context) aborts the transaction. Events
 * with no matching aggregate (e.g. `EventEmittingAdapter`) are stamped from context only.
 */
export function enrichDomainEvents(
  events: ReadonlyArray<DomainEvent>,
  actor: Actor | null,
  trackedAggregates: ReadonlyArray<AggregateRoot<Identifier, object>>,
): void {
  const aggregatesById = new Map<string, AggregateRoot<Identifier, object>>();
  for (const aggregate of trackedAggregates) {
    aggregatesById.set(aggregate.id.value, aggregate);
  }

  const companyId = actor?.companyId ?? null;
  const actorId = actor?.actorId ?? null;
  const actorType = actor?.actorType ?? null;

  // Privileged actors (operator/system) act across tenants by design (ADR-009), so the
  // cross-check only guards non-privileged actors against accidental cross-tenant writes.
  const privileged = isPrivilegedActorType(actorType);

  for (const event of events) {
    const aggregate = aggregatesById.get(event.aggregateId);
    if (
      !privileged &&
      aggregate !== undefined &&
      isTenantScoped(aggregate) &&
      aggregate.companyId !== companyId
    ) {
      throw new EnvelopeTenantMismatchError(event.aggregateId, aggregate.companyId, companyId);
    }

    const stampable = event as unknown as StampableEnvelope;
    stampable.companyId = companyId;
    stampable.actorId = actorId;
    stampable.actorType = actorType;
  }
}
