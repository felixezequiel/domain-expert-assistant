import type { EntityManagerProvider } from "../../../shared/infrastructure/persistence/adapters/EntityManagerProvider.ts";
import type { InfrastructureResult } from "../../../shared/factories/index.ts";
import type { LoggerPort } from "../../../shared/ports/LoggerPort.ts";
import type { ResolveSessionUseCase } from "../../identity/application/usecase/ResolveSessionUseCase.ts";
import type { UserDirectoryPort } from "../../../shared/ports/UserDirectoryPort.ts";

import { MikroOrmAuditTrailRepository } from "../infrastructure/persistence/mikro-orm/MikroOrmAuditTrailRepository.ts";
import { ListAuditTrailUseCase } from "../application/usecase/ListAuditTrailUseCase.ts";
import { AuditModule } from "../bootstrap/AuditModule.ts";

export interface AuditModuleDependencies {
  readonly resolveSession: ResolveSessionUseCase;
  // Resolves event actor ids to display names (ADR-013-style cross-module read).
  readonly userDirectory: UserDirectoryPort;
}

export interface AuditModuleSetup {
  register(infrastructure: InfrastructureResult, logger: LoggerPort): void;
}

/**
 * Composition for the Audit slice (PRD-6, Auditor persona). A pure read side over the shared
 * event store (`system_events`) — no aggregate, no persister. Authorization (auditor/admin)
 * lives on the use case and tenant scoping on the repository's company filter (ADR-009/011).
 */
export class AuditModuleFactory {
  public static create(
    entityManagerProvider: EntityManagerProvider,
    dependencies: AuditModuleDependencies,
  ): AuditModuleSetup {
    const auditTrailRepository = new MikroOrmAuditTrailRepository(entityManagerProvider);
    const listAuditTrail = new ListAuditTrailUseCase(auditTrailRepository, dependencies.userDirectory);

    return {
      register(infrastructure: InfrastructureResult, _logger: LoggerPort): void {
        const auditModule = new AuditModule({
          applicationService: infrastructure.applicationService,
          resolveSession: dependencies.resolveSession,
          listAuditTrail,
        });
        auditModule.registerRoutes(infrastructure.httpServer);
      },
    };
  }
}
