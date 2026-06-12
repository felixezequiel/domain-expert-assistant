import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getCorrelationId, runWithCorrelationId } from "./CorrelationIdMiddleware.ts";

describe("CorrelationIdMiddleware", () => {
  describe("getCorrelationId", () => {
    it("should return undefined when not inside a correlation context", () => {
      const correlationId = getCorrelationId();

      assert.equal(correlationId, undefined);
    });

    it("should return the correlation ID when inside a context", async () => {
      let capturedId: string | undefined;

      await runWithCorrelationId("test-123", async () => {
        capturedId = getCorrelationId();
      });

      assert.equal(capturedId, "test-123");
    });

    it("should isolate correlation IDs across concurrent contexts", async () => {
      const capturedIds: Array<string | undefined> = [];

      const firstRequest = runWithCorrelationId("request-1", async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        capturedIds.push(getCorrelationId());
      });

      const secondRequest = runWithCorrelationId("request-2", async () => {
        capturedIds.push(getCorrelationId());
      });

      await Promise.all([firstRequest, secondRequest]);

      assert.ok(capturedIds.includes("request-1"));
      assert.ok(capturedIds.includes("request-2"));
    });
  });

  describe("runWithCorrelationId", () => {
    it("should return the result of the callback", async () => {
      const result = await runWithCorrelationId("id-1", async () => {
        return "hello";
      });

      assert.equal(result, "hello");
    });

    it("should propagate errors from the callback", async () => {
      await assert.rejects(
        () =>
          runWithCorrelationId("id-1", async () => {
            throw new Error("boom");
          }),
        { message: "boom" },
      );
    });
  });
});
