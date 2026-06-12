import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { log } from "./Log.ts";
import { LoggerRegistry } from "../logging/LoggerRegistry.ts";
import type { LoggerPort } from "../../ports/LoggerPort.ts";

interface LogEntry {
  readonly level: string;
  readonly message: string;
  readonly context?: Record<string, unknown> | undefined;
}

class SpyLogger implements LoggerPort {
  public entries: Array<LogEntry> = [];

  public info(message: string, context?: Record<string, unknown>): void {
    this.entries.push({ level: "info", message, context });
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.entries.push({ level: "warn", message, context });
  }

  public error(message: string, context?: Record<string, unknown>): void {
    this.entries.push({ level: "error", message, context });
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    this.entries.push({ level: "debug", message, context });
  }
}

describe("@log decorator", () => {
  let spyLogger: SpyLogger;

  beforeEach(() => {
    spyLogger = new SpyLogger();
    LoggerRegistry.setLogger(spyLogger);
  });

  it("should log method entry and exit for sync methods", () => {
    class Calculator {
      @log
      public add(a: number, b: number): number {
        return a + b;
      }
    }

    const calculator = new Calculator();
    const result = calculator.add(2, 3);

    assert.equal(result, 5);
    assert.equal(spyLogger.entries.length, 2);
    assert.equal(spyLogger.entries[0]!.message, "Calculator.add - entry");
    assert.equal(spyLogger.entries[1]!.message, "Calculator.add - exit");
  });

  it("should log method entry and exit for async methods", async () => {
    class UserService {
      @log
      public async findUser(userId: string): Promise<string> {
        return "user-" + userId;
      }
    }

    const service = new UserService();
    const result = await service.findUser("123");

    assert.equal(result, "user-123");
    assert.equal(spyLogger.entries.length, 2);
    assert.equal(spyLogger.entries[0]!.message, "UserService.findUser - entry");
    assert.equal(spyLogger.entries[1]!.message, "UserService.findUser - exit");
  });

  it("should log error when method throws", () => {
    class FailingService {
      @log
      public fail(): never {
        throw new Error("something broke");
      }
    }

    const service = new FailingService();

    assert.throws(() => service.fail(), { message: "something broke" });
    assert.equal(spyLogger.entries.length, 2);
    assert.equal(spyLogger.entries[0]!.message, "FailingService.fail - entry");
    assert.equal(spyLogger.entries[1]!.level, "error");
    assert.equal(spyLogger.entries[1]!.message, "FailingService.fail - error");
  });

  it("should log error when async method rejects", async () => {
    class AsyncFailingService {
      @log
      public async fail(): Promise<void> {
        throw new Error("async failure");
      }
    }

    const service = new AsyncFailingService();

    await assert.rejects(() => service.fail(), { message: "async failure" });
    assert.equal(spyLogger.entries.length, 2);
    assert.equal(spyLogger.entries[1]!.level, "error");
  });

  it("should use custom log level when configured via factory", () => {
    class DebugService {
      @log({ level: "debug" })
      public doWork(): string {
        return "done";
      }
    }

    const service = new DebugService();
    service.doWork();

    assert.equal(spyLogger.entries[0]!.level, "debug");
    assert.equal(spyLogger.entries[1]!.level, "debug");
  });

  it("should include arguments in entry log context", () => {
    class Service {
      @log
      public process(_name: string, _count: number): void {
        // no-op
      }
    }

    const service = new Service();
    service.process("test", 42);

    assert.deepEqual(spyLogger.entries[0]!.context!.args, ["test", 42]);
  });

  it("should include duration in exit log context", () => {
    class Service {
      @log
      public work(): string {
        return "result";
      }
    }

    const service = new Service();
    service.work();

    const exitContext = spyLogger.entries[1]!.context!;
    assert.ok(typeof exitContext.durationMs === "number");
  });
});
