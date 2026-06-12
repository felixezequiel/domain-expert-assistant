import type { AlertPort } from "./AlertPort.ts";

export class ErrorHandler {
  private readonly alertPort: AlertPort;
  private isRegistered = false;

  constructor(alertPort: AlertPort) {
    this.alertPort = alertPort;
  }

  public register(): void {
    if (this.isRegistered) {
      return;
    }

    process.on("uncaughtException", (error: Error) => {
      this.handleError("uncaughtException", error);
    });

    process.on("unhandledRejection", (reason: unknown) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.handleError("unhandledRejection", error);
    });

    this.isRegistered = true;
  }

  public async handleError(source: string, error: Error): Promise<void> {
    await this.alertPort.sendAlert("critical", `Unhandled error: ${error.message}`, {
      source,
      errorName: error.name,
      stack: error.stack ?? "no stack trace",
    });
  }
}
