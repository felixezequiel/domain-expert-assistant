/**
 * MikroORM global filter for multi-tenancy isolation.
 *
 * Each tenant-scoped EntitySchema must include this filter in its `filters` property:
 *
 *   new EntitySchema({
 *     // ...
 *     filters: {
 *       [COMPANY_TENANT_FILTER_NAME]: companyTenantFilterDefinition,
 *     },
 *   });
 *
 * The filter uses `default: true` so it is always active on tenant-scoped entities.
 * The `cond` function is tolerant of missing args — when no filter params have been
 * set (public routes, non-tenant scheduled tasks), it returns an empty condition
 * which effectively disables filtering. When params are set via
 * `em.setFilterParams()` in MikroOrmUnitOfWork.onBegin(), the filter adds
 * `WHERE company_id = :companyId` to all queries.
 */

export const COMPANY_TENANT_FILTER_NAME = "companyTenant";

interface CompanyTenantArgs {
  readonly companyId: string;
}

export const companyTenantFilterDefinition = {
  name: COMPANY_TENANT_FILTER_NAME,
  cond(args: CompanyTenantArgs | undefined): Record<string, string> {
    if (args === undefined || args === null || args.companyId === undefined) {
      return {};
    }
    return { companyId: args.companyId };
  },
  default: true,
  args: false,
};
