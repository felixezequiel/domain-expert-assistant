export type AlertLevel = "info" | "warning" | "critical";

export interface AlertPort {
  sendAlert(level: AlertLevel, message: string, context?: Record<string, unknown>): Promise<void>;
}
