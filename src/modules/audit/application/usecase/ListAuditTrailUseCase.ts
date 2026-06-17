import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { Role } from "../../../../shared/domain/Role.ts";
import type { UserDirectoryPort } from "../../../../shared/ports/UserDirectoryPort.ts";
import type { ListAuditTrailQuery } from "../query/ListAuditTrailQuery.ts";
import type { AuditEventView, AuditTrailReadPort } from "../types.ts";

export class ListAuditTrailUseCase
  implements UseCase<ListAuditTrailQuery, ReadonlyArray<AuditEventView>>
{
  // Auditors read the trail; admins may inspect it too (ADR-011). Tenant scoping is a
  // separate, deeper guarantee (the repository's company filter), not a role check.
  public readonly requiredRoles: ReadonlyArray<Role> = ["auditor", "admin"];

  private readonly auditTrailReadPort: AuditTrailReadPort;
  private readonly userDirectory: UserDirectoryPort;

  constructor(auditTrailReadPort: AuditTrailReadPort, userDirectory: UserDirectoryPort) {
    this.auditTrailReadPort = auditTrailReadPort;
    this.userDirectory = userDirectory;
  }

  public async execute(query: ListAuditTrailQuery): Promise<ReadonlyArray<AuditEventView>> {
    const events = await this.auditTrailReadPort.findEvents(query.filter);
    const actorIds = events
      .map((event) => event.actorId)
      .filter((actorId): actorId is string => actorId !== null);
    const actorNames = await this.userDirectory.resolveDisplayNames(actorIds);
    return events.map((event) => ({
      ...event,
      actorName: ListAuditTrailUseCase.nameFor(event.actorId, actorNames),
    }));
  }

  private static nameFor(
    actorId: string | null,
    actorNames: ReadonlyMap<string, string>,
  ): string | null {
    if (actorId === null) {
      return null;
    }
    const resolved = actorNames.get(actorId);
    return resolved === undefined ? null : resolved;
  }
}
