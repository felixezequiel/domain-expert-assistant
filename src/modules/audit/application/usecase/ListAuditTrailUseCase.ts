import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { ListAuditTrailQuery } from "../query/ListAuditTrailQuery.ts";
import type { AuditEventView, AuditTrailReadPort } from "../types.ts";

export class ListAuditTrailUseCase
  implements UseCase<ListAuditTrailQuery, ReadonlyArray<AuditEventView>>
{
  private readonly auditTrailReadPort: AuditTrailReadPort;

  constructor(auditTrailReadPort: AuditTrailReadPort) {
    this.auditTrailReadPort = auditTrailReadPort;
  }

  public async execute(query: ListAuditTrailQuery): Promise<ReadonlyArray<AuditEventView>> {
    return this.auditTrailReadPort.findEvents(query.filter);
  }
}
