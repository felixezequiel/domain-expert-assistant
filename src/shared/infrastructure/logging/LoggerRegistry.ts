import type { LoggerPort } from "../../ports/LoggerPort.ts";
import { ConsoleLogger } from "./ConsoleLogger.ts";

export class LoggerRegistry {
  private static logger: LoggerPort = new ConsoleLogger();

  public static getLogger(): LoggerPort {
    return LoggerRegistry.logger;
  }

  public static setLogger(logger: LoggerPort): void {
    LoggerRegistry.logger = logger;
  }

  public static reset(): void {
    LoggerRegistry.logger = new ConsoleLogger();
  }
}
