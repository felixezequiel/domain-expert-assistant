import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ConsoleLogger } from "./ConsoleLogger.ts";

describe("ConsoleLogger", () => {
  let originalStdoutWrite: typeof process.stdout.write;
  let capturedOutput: Array<string>;

  beforeEach(() => {
    capturedOutput = [];
    originalStdoutWrite = process.stdout.write;
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      capturedOutput.push(chunk.toString());
      return true;
    };
  });

  afterEach(() => {
    process.stdout.write = originalStdoutWrite;
  });

  it("should log info level as structured JSON", () => {
    const logger = new ConsoleLogger();

    logger.info("server started");

    assert.equal(capturedOutput.length, 1);
    const parsed = JSON.parse(capturedOutput[0]!);
    assert.equal(parsed.level, "info");
    assert.equal(parsed.message, "server started");
    assert.ok(parsed.timestamp);
  });

  it("should log warn level", () => {
    const logger = new ConsoleLogger();

    logger.warn("disk space low");

    const parsed = JSON.parse(capturedOutput[0]!);
    assert.equal(parsed.level, "warn");
    assert.equal(parsed.message, "disk space low");
  });

  it("should log error level", () => {
    const logger = new ConsoleLogger();

    logger.error("connection failed");

    const parsed = JSON.parse(capturedOutput[0]!);
    assert.equal(parsed.level, "error");
    assert.equal(parsed.message, "connection failed");
  });

  it("should log debug level", () => {
    const logger = new ConsoleLogger();

    logger.debug("query executed");

    const parsed = JSON.parse(capturedOutput[0]!);
    assert.equal(parsed.level, "debug");
    assert.equal(parsed.message, "query executed");
  });

  it("should include context when provided", () => {
    const logger = new ConsoleLogger();

    logger.info("user created", { userId: "abc-123", email: "user@test.com" });

    const parsed = JSON.parse(capturedOutput[0]!);
    assert.equal(parsed.context.userId, "abc-123");
    assert.equal(parsed.context.email, "user@test.com");
  });

  it("should not include context key when no context is provided", () => {
    const logger = new ConsoleLogger();

    logger.info("simple message");

    const parsed = JSON.parse(capturedOutput[0]!);
    assert.equal(parsed.context, undefined);
  });
});
