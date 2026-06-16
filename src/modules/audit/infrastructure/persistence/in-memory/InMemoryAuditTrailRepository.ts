import type {
  AuditEventView,
  AuditTrailFilter,
  AuditTrailReadPort,
} from "../../../application/types.ts";
import { getCurrentActor } from "../../../../../shared/application/context/ActorContext.ts";
import { resolveTenantScope } from "../../../../../shared/application/tenancy/TenantScopeResolution.ts";

/**
 * In-memory audit trail read model for tests. Encodes the same fail-closed tenant
 * scoping the production adapter gets from the MikroORM company filter (ADR-009): a
 * tenant scope sees only its own events; a privileged scope sees everything; no scope
 * throws. The MikroORM adapter is wired when the Auditor surface lands (PRD-5/6).
 */
export class InMemoryAuditTrailRepository implements AuditTrailReadPort {
  private readonly events: Array<AuditEventView> = [];

  public seed(event: AuditEventView): void {
    this.events.push(event);
  }

  public async findEvents(filter: AuditTrailFilter): Promise<ReadonlyArray<AuditEventView>> {
    const decision = resolveTenantScope(getCurrentActor());
    const results: Array<AuditEventView> = [];

    for (const event of this.events) {
      if (decision.kind === "filtered" && event.companyId !== decision.companyId) {
        continue;
      }
      if (!InMemoryAuditTrailRepository.matchesFilter(event, filter)) {
        continue;
      }
      results.push(event);
      if (results.length >= filter.limit) {
        break;
      }
    }

    return results;
  }

  private static matchesFilter(event: AuditEventView, filter: AuditTrailFilter): boolean {
    if (filter.aggregateId !== null && event.aggregateId !== filter.aggregateId) {
      return false;
    }
    if (filter.actorId !== null && event.actorId !== filter.actorId) {
      return false;
    }
    if (filter.eventName !== null && event.eventName !== filter.eventName) {
      return false;
    }

    const occurredAt = new Date(event.occurredAt).getTime();
    if (filter.from !== null && occurredAt < filter.from.getTime()) {
      return false;
    }
    if (filter.to !== null && occurredAt > filter.to.getTime()) {
      return false;
    }

    return true;
  }
}
