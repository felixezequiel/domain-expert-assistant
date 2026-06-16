import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { Role } from "../../../../shared/domain/Role.ts";
import type { ListAuditTrailQuery } from "../query/ListAuditTrailQuery.ts";
import type { AuditEventView, AuditTrailReadPort } from "../types.ts";

export class ListAuditTrailUseCase
  implements UseCase<ListAuditTrailQuery, ReadonlyArray<AuditEventView>>
{
  // Auditors read the trail; admins may inspect it too (ADR-011). Tenant scoping is a
  // separate, deeper guarantee (the repository's company filter), not a role check.
  public readonly requiredRoles: ReadonlyArray<Role> = ["auditor", "admin"];

  private readonly auditTrailReadPort: AuditTrailReadPort;

  constructor(auditTrailReadPort: AuditTrailReadPort) {
    this.auditTrailReadPort = auditTrailReadPort;
  }

  public async execute(query: ListAuditTrailQuery): Promise<ReadonlyArray<AuditEventView>> {
    return this.auditTrailReadPort.findEvents(query.filter);
  }
}
