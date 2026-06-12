import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ConsoleAlertAdapter } from "./ConsoleAlertAdapter.ts";

describe("ConsoleAlertAdapter", () => {
  it("should output an info alert with [INFO] prefix", async () => {
    const lines: string[] = [];
    const adapter = new ConsoleAlertAdapter((line) => lines.push(line));

    await adapter.sendAlert("info", "System started");

    assert.equal(lines.length, 1);
    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
    assert.equal(parsed.alert, "[INFO]");
    assert.equal(parsed.message, "System started");
    assert.ok(typeof parsed.timestamp === "string");
  });

  it("should output a warning alert with [WARNING] prefix", async () => {
    const lines: string[] = [];
    const adapter = new ConsoleAlertAdapter((line) => lines.push(line));

    await adapter.sendAlert("warning", "Disk space low");

    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
    assert.equal(parsed.alert, "[WARNING]");
    assert.equal(parsed.message, "Disk space low");
  });

  it("should output a critical alert with [CRITICAL] prefix", async () => {
    const lines: string[] = [];
    const adapter = new ConsoleAlertAdapter((line) => lines.push(line));

    await adapter.sendAlert("critical", "Database unreachable");

    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
    assert.equal(parsed.alert, "[CRITICAL]");
    assert.equal(parsed.message, "Database unreachable");
  });

  it("should include context when provided", async () => {
    const lines: string[] = [];
    const adapter = new ConsoleAlertAdapter((line) => lines.push(line));

    await adapter.sendAlert("info", "Request processed", { requestId: "abc-123", duration: 42 });

    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
    const context = parsed.context as Record<string, unknown>;
    assert.equal(context.requestId, "abc-123");
    assert.equal(context.duration, 42);
  });

  it("should not include context key when context is not provided", async () => {
    const lines: string[] = [];
    const adapter = new ConsoleAlertAdapter((line) => lines.push(line));

    await adapter.sendAlert("info", "Simple alert");

    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
    assert.equal("context" in parsed, false);
  });

  it("should include a valid ISO timestamp", async () => {
    const lines: string[] = [];
    const adapter = new ConsoleAlertAdapter((line) => lines.push(line));

    await adapter.sendAlert("info", "Test");

    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
    const timestamp = parsed.timestamp as string;
    const date = new Date(timestamp);
    assert.ok(!isNaN(date.getTime()));
  });
});
