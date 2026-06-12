import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { COMPANY_TENANT_FILTER_NAME, companyTenantFilterDefinition } from "./CompanyFilter.ts";

describe("CompanyFilter", () => {
  it("should have the filter name 'companyTenant'", () => {
    assert.equal(COMPANY_TENANT_FILTER_NAME, "companyTenant");
  });

  it("should return a condition with companyId from args", () => {
    const companyId = "company-123";
    const condition = companyTenantFilterDefinition.cond({ companyId });

    assert.deepStrictEqual(condition, { companyId: "company-123" });
  });

  it("should be enabled by default (always active on tenant-scoped entities)", () => {
    assert.equal(companyTenantFilterDefinition.default, true);
  });

  it("should return empty condition when args is undefined (no tenant context)", () => {
    const condition = companyTenantFilterDefinition.cond(
      undefined as unknown as { companyId: string },
    );

    assert.deepStrictEqual(condition, {});
  });

  it("should return empty condition when args is null (no tenant context)", () => {
    const condition = companyTenantFilterDefinition.cond(null as unknown as { companyId: string });

    assert.deepStrictEqual(condition, {});
  });

  it("should return condition with different companyId values", () => {
    const firstCondition = companyTenantFilterDefinition.cond({ companyId: "aaa" });
    const secondCondition = companyTenantFilterDefinition.cond({ companyId: "bbb" });

    assert.deepStrictEqual(firstCondition, { companyId: "aaa" });
    assert.deepStrictEqual(secondCondition, { companyId: "bbb" });
  });
});
