import type { AlertLevel, AlertPort } from "./AlertPort.ts";

export class ConsoleAlertAdapter implements AlertPort {
  private readonly output: (line: string) => void;

  constructor(output?: (line: string) => void) {
    this.output = output ?? ((line: string) => process.stdout.write(line + "\n"));
  }

  public async sendAlert(
    level: AlertLevel,
    message: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const prefix = this.formatPrefix(level);
    const entry: Record<string, unknown> = {
      alert: prefix,
      message,
      timestamp: new Date().toISOString(),
    };

    if (context !== undefined) {
      entry.context = context;
    }

    this.output(JSON.stringify(entry));
  }

  private formatPrefix(level: AlertLevel): string {
    switch (level) {
      case "info":
        return "[INFO]";
      case "warning":
        return "[WARNING]";
      case "critical":
        return "[CRITICAL]";
    }
  }
}
