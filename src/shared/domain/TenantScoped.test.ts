import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isTenantScoped } from "./TenantScoped.ts";

describe("isTenantScoped", () => {
  it("recognises an object exposing a string companyId", () => {
    assert.equal(isTenantScoped({ companyId: "company-1" }), true);
  });

  it("recognises an object whose companyId comes from a getter", () => {
    const aggregate = {
      get companyId(): string {
        return "company-1";
      },
    };

    assert.equal(isTenantScoped(aggregate), true);
  });

  it("rejects an object without companyId", () => {
    assert.equal(isTenantScoped({ name: "x" }), false);
  });

  it("rejects an object whose companyId is not a string", () => {
    assert.equal(isTenantScoped({ companyId: 123 }), false);
    assert.equal(isTenantScoped({ companyId: null }), false);
  });

  it("rejects null and primitives", () => {
    assert.equal(isTenantScoped(null), false);
    assert.equal(isTenantScoped(undefined), false);
    assert.equal(isTenantScoped("company-1"), false);
  });
});
