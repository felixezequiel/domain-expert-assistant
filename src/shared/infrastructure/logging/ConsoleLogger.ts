import type { LoggerPort } from "../../ports/LoggerPort.ts";
import { getCorrelationId } from "../http/CorrelationIdMiddleware.ts";

export class ConsoleLogger implements LoggerPort {
  public info(message: string, context?: Record<string, unknown>): void {
    this.write("info", message, context);
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.write("warn", message, context);
  }

  public error(message: string, context?: Record<string, unknown>): void {
    this.write("error", message, context);
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    this.write("debug", message, context);
  }

  private write(level: string, message: string, context?: Record<string, unknown>): void {
    const entry: Record<string, unknown> = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    const correlationId = getCorrelationId();
    if (correlationId !== undefined) {
      entry.correlationId = correlationId;
    }

    if (context !== undefined) {
      entry.context = context;
    }

    process.stdout.write(JSON.stringify(entry) + "\n");
  }
}
