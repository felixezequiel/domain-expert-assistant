import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  COMPANY_OR_SYSTEM_FILTER_NAME,
  companyOrSystemFilterDefinition,
} from "./CompanyOrSystemFilter.ts";

describe("CompanyOrSystemFilter", () => {
  it("is named and defaults on", () => {
    assert.equal(COMPANY_OR_SYSTEM_FILTER_NAME, "companyOrSystem");
    assert.equal(companyOrSystemFilterDefinition.default, true);
  });

  it("matches the tenant's rows OR system rows when a tenant is set", () => {
    assert.deepEqual(companyOrSystemFilterDefinition.cond({ companyId: "c1" }), {
      $or: [{ companyId: "c1" }, { scope: "system" }],
    });
  });

  it("falls back to only system rows when no tenant is set", () => {
    assert.deepEqual(companyOrSystemFilterDefinition.cond(undefined), { scope: "system" });
  });
});
