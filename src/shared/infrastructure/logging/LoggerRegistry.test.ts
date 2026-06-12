import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { LoggerRegistry } from "./LoggerRegistry.ts";
import type { LoggerPort } from "../../ports/LoggerPort.ts";

class FakeLogger implements LoggerPort {
  public lastMessage = "";
  public lastLevel = "";

  public info(message: string): void {
    this.lastLevel = "info";
    this.lastMessage = message;
  }

  public warn(message: string): void {
    this.lastLevel = "warn";
    this.lastMessage = message;
  }

  public error(message: string): void {
    this.lastLevel = "error";
    this.lastMessage = message;
  }

  public debug(message: string): void {
    this.lastLevel = "debug";
    this.lastMessage = message;
  }
}

describe("LoggerRegistry", () => {
  beforeEach(() => {
    LoggerRegistry.reset();
  });

  it("should return a default ConsoleLogger when no logger is set", () => {
    const logger = LoggerRegistry.getLogger();

    assert.ok(logger !== null);
    assert.ok(logger !== undefined);
  });

  it("should return the custom logger after setLogger is called", () => {
    const fakeLogger = new FakeLogger();

    LoggerRegistry.setLogger(fakeLogger);
    const logger = LoggerRegistry.getLogger();

    logger.info("test message");

    assert.equal(fakeLogger.lastLevel, "info");
    assert.equal(fakeLogger.lastMessage, "test message");
  });

  it("should allow replacing the logger at runtime", () => {
    const firstLogger = new FakeLogger();
    const secondLogger = new FakeLogger();

    LoggerRegistry.setLogger(firstLogger);
    LoggerRegistry.setLogger(secondLogger);
    const logger = LoggerRegistry.getLogger();

    logger.info("test");

    assert.equal(firstLogger.lastMessage, "");
    assert.equal(secondLogger.lastMessage, "test");
  });

  it("should reset to default logger", () => {
    const fakeLogger = new FakeLogger();

    LoggerRegistry.setLogger(fakeLogger);
    LoggerRegistry.reset();
    const logger = LoggerRegistry.getLogger();

    logger.info("after reset");

    assert.equal(fakeLogger.lastMessage, "");
  });
});
