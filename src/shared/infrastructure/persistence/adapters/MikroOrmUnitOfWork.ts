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

  protected async onBegin(): Promise<void> {
    const currentEntityManager = this.entityManagerProvider.getEntityManager();
    const forkedEntityManager = currentEntityManager.fork();

    // Fail-closed tenant isolation (ADR-009): a tenant scope enables the company
    // filter; a privileged (operator/system) scope deliberately runs unfiltered;
    // anything else throws rather than silently leaking or returning empty.
    const decision = resolveTenantScope(getCurrentActor());
    if (decision.kind === "filtered") {
      forkedEntityManager.setFilterParams(COMPANY_TENANT_FILTER_NAME, {
        companyId: decision.companyId,
      });
      // Shared-reference tables (tags) see this tenant's rows plus system rows (ADR-014).
      forkedEntityManager.setFilterParams(COMPANY_OR_SYSTEM_FILTER_NAME, {
        companyId: decision.companyId,
      });
    }

    this.entityManagerProvider.setEntityManager(forkedEntityManager);
  }

  protected async onCommit(
    trackedAggregates: ReadonlyArray<AggregateRoot<Identifier, object>>,
  ): Promise<void> {
    const entityManager = this.entityManagerProvider.getEntityManager();

    await entityManager.transactional(async (txEm) => {
      for (const aggregate of trackedAggregates) {
        for (const persister of this.persisters) {
          if (persister.supports(aggregate)) {
            if (aggregate.isMarkedForDeletion()) {
              await persister.delete(aggregate, txEm);
            } else {
              await persister.persist(aggregate, txEm);
            }
            break;
          }
        }
      }
    });
  }

  protected async onRollback(): Promise<void> {
    const entityManager = this.entityManagerProvider.getEntityManager();
    entityManager.clear();
  }
}
