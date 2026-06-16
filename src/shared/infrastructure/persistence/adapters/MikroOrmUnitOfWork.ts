import type { AggregateRoot } from "../../../domain/aggregates/AggregateRoot.ts";
import type { Identifier } from "../../../domain/identifiers/Identifier.ts";
import type { AggregatePersister } from "../AggregatePersister.ts";
import type { EntityManagerProvider } from "./EntityManagerProvider.ts";
import { TrackedUnitOfWork } from "../TrackedUnitOfWork.ts";
import { getCurrentActor } from "../../../application/context/ActorContext.ts";
import { resolveTenantScope } from "../../../application/tenancy/TenantScopeResolution.ts";
import { COMPANY_TENANT_FILTER_NAME } from "../filters/CompanyFilter.ts";
import { COMPANY_OR_SYSTEM_FILTER_NAME } from "../filters/CompanyOrSystemFilter.ts";

export class MikroOrmUnitOfWork extends TrackedUnitOfWork {
  private readonly entityManagerProvider: EntityManagerProvider;
  private readonly persisters: ReadonlyArray<AggregatePersister>;

  constructor(
    entityManagerProvider: EntityManagerProvider,
    persisters: ReadonlyArray<AggregatePersister>,
  ) {
    super();
    this.entityManagerProvider = entityManagerProvider;
    this.persisters = persisters;
  }

  protected async onBegin(readOnly: boolean): Promise<void> {
    // Fail-closed tenant isolation (ADR-009): a tenant scope enables the company filter; a
    // privileged (operator/system) scope deliberately runs unfiltered; anything else throws.
    // Resolved BEFORE the transaction opens so a fail-closed throw never leaks an open
    // transaction (begin() runs outside the ApplicationService try/rollback).
    const decision = resolveTenantScope(getCurrentActor());

    const forkedEntityManager = this.entityManagerProvider.getEntityManager().fork();
    if (decision.kind === "filtered") {
      forkedEntityManager.setFilterParams(COMPANY_TENANT_FILTER_NAME, {
        companyId: decision.companyId,
      });
      // Shared-reference tables (tags) see this tenant's rows plus system rows (ADR-014).
      forkedEntityManager.setFilterParams(COMPANY_OR_SYSTEM_FILTER_NAME, {
        companyId: decision.companyId,
      });
    }

    // One transaction spans the whole use case (ADR-004 amendment): every read and write runs
    // inside it and commits atomically; queries opt into READ ONLY. This is also the seam RLS
    // needs — a transaction to SET LOCAL the tenant id (task #8).
    await forkedEntityManager.begin({ readOnly });

    this.entityManagerProvider.setEntityManager(forkedEntityManager);
  }

  protected async onCommit(
    trackedAggregates: ReadonlyArray<AggregateRoot<Identifier, object>>,
  ): Promise<void> {
    const entityManager = this.entityManagerProvider.getEntityManager();

    for (const aggregate of trackedAggregates) {
      for (const persister of this.persisters) {
        if (persister.supports(aggregate)) {
          if (aggregate.isMarkedForDeletion()) {
            await persister.delete(aggregate, entityManager);
          } else {
            await persister.persist(aggregate, entityManager);
          }
          break;
        }
      }
    }

    // The UnitOfWork owns the single flush/commit (ADR-004): this writes the persister upserts,
    // the staged event-store rows, and any other staged persist, then commits the transaction
    // opened in onBegin — all atomically.
    await entityManager.flush();
    await entityManager.commit();
  }

  protected async onRollback(): Promise<void> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    if (entityManager.isInTransaction()) {
      await entityManager.rollback();
    }
    entityManager.clear();
  }
}
