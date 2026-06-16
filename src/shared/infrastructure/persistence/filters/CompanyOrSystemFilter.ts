/**
 * Tenant filter for shared-reference tables (ADR-014 amendment to ADR-009): a row is
 * visible when it belongs to the current tenant OR is product-seeded system reference data
 * (`scope = 'system'`, `company_id = null`). The only place this exception applies today is
 * the `tags` table. With no tenant in context, only system rows are visible (fail-safe:
 * never leaks tenant data, only the deliberately-shared vocabulary).
 *
 * Params are set per transaction by `MikroOrmUnitOfWork.onBegin`, alongside the strict
 * company filter, from the resolved Actor Context.
 */
export const COMPANY_OR_SYSTEM_FILTER_NAME = "companyOrSystem";

interface CompanyOrSystemArgs {
  readonly companyId: string;
}

export const companyOrSystemFilterDefinition = {
  name: COMPANY_OR_SYSTEM_FILTER_NAME,
  cond(args: CompanyOrSystemArgs | undefined): Record<string, unknown> {
    if (args === undefined || args === null || args.companyId === undefined) {
      return { scope: "system" };
    }
    return { $or: [{ companyId: args.companyId }, { scope: "system" }] };
  },
  default: true,
  args: false,
};
