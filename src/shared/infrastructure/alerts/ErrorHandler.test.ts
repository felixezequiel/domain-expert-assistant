import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ErrorHandler } from "./ErrorHandler.ts";
import type { AlertLevel, AlertPort } from "./AlertPort.ts";

interface CapturedAlert {
  level: AlertLevel;
  message: string;
  context?: Record<string, unknown> | undefined;
}

function createFakeAlertPort(): AlertPort & { alerts: CapturedAlert[] } {
  const alerts: CapturedAlert[] = [];
  return {
    alerts,
    sendAlert: async (level, message, context) => {
      alerts.push({ level, message, context });
    },
  };
}

describe("ErrorHandler", () => {
  describe("handleError", () => {
    it("should send a critical alert with the error message", async () => {
      const alertPort = createFakeAlertPort();
      const handler = new ErrorHandler(alertPort);

      await handler.handleError("test", new Error("Something broke"));

      assert.equal(alertPort.alerts.length, 1);
      assert.equal(alertPort.alerts[0]!.level, "critical");
      assert.equal(alertPort.alerts[0]!.message, "Unhandled error: Something broke");
    });

    it("should include source in context", async () => {
      const alertPort = createFakeAlertPort();
      const handler = new ErrorHandler(alertPort);

      await handler.handleError("uncaughtException", new Error("fail"));

      const context = alertPort.alerts[0]!.context!;
      assert.equal(context.source, "uncaughtException");
    });

    it("should include error name in context", async () => {
      const alertPort = createFakeAlertPort();
      const handler = new ErrorHandler(alertPort);

      const error = new TypeError("type mismatch");
      await handler.handleError("test", error);

      const context = alertPort.alerts[0]!.context!;
      assert.equal(context.errorName, "TypeError");
    });

    it("should include stack trace in context", async () => {
      const alertPort = createFakeAlertPort();
      const handler = new ErrorHandler(alertPort);

      const error = new Error("with stack");
      await handler.handleError("test", error);

      const context = alertPort.alerts[0]!.context!;
      assert.ok(typeof context.stack === "string");
      assert.ok((context.stack as string).length > 0);
    });

    it("should handle errors without stack trace", async () => {
      const alertPort = createFakeAlertPort();
      const handler = new ErrorHandler(alertPort);

      const error = new Error("no stack");
      (error as { stack: string | undefined }).stack = undefined;
      await handler.handleError("test", error);

      const context = alertPort.alerts[0]!.context!;
      assert.equal(context.stack, "no stack trace");
    });
  });

  describe("register", () => {
    it("should not throw when calling register", () => {
      const alertPort = createFakeAlertPort();
      const handler = new ErrorHandler(alertPort);

      assert.doesNotThrow(() => handler.register());
    });

    it("should be idempotent — calling register twice does not throw", () => {
      const alertPort = createFakeAlertPort();
      const handler = new ErrorHandler(alertPort);

      handler.register();
      assert.doesNotThrow(() => handler.register());
    });
  });
});
