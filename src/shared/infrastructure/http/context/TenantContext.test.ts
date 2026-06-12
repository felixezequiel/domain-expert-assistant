import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runWithTenant, getCurrentCompanyId } from "./TenantContext.ts";

describe("TenantContext", () => {
  describe("getCurrentCompanyId", () => {
    it("should return null when called outside tenant context", () => {
      const result = getCurrentCompanyId();

      assert.equal(result, null);
    });
  });

  describe("runWithTenant", () => {
    it("should provide companyId within the callback", async () => {
      let capturedCompanyId: string | null = null;

      await runWithTenant("company-123", async () => {
        capturedCompanyId = getCurrentCompanyId();
      });

      assert.equal(capturedCompanyId, "company-123");
    });

    it("should return the callback result", async () => {
      const result = await runWithTenant("company-1", async () => {
        return "hello";
      });

      assert.equal(result, "hello");
    });

    it("should not leak companyId after callback completes", async () => {
      await runWithTenant("company-456", async () => {
        // inside context
      });

      const result = getCurrentCompanyId();
      assert.equal(result, null);
    });

    it("should isolate companyId between concurrent runs", async () => {
      const results: Array<string | null> = [];

      await Promise.all([
        runWithTenant("company-A", async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          results.push(getCurrentCompanyId());
        }),
        runWithTenant("company-B", async () => {
          results.push(getCurrentCompanyId());
        }),
      ]);

      assert.ok(results.includes("company-A"));
      assert.ok(results.includes("company-B"));
    });

    it("should support nested tenant contexts", async () => {
      let outerCompanyId: string | null = null;
      let innerCompanyId: string | null = null;

      await runWithTenant("outer-company", async () => {
        outerCompanyId = getCurrentCompanyId();

        await runWithTenant("inner-company", async () => {
          innerCompanyId = getCurrentCompanyId();
        });
      });

      assert.equal(outerCompanyId, "outer-company");
      assert.equal(innerCompanyId, "inner-company");
    });
  });
});
