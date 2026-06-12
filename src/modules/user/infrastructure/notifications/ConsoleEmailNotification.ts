import type { EmailNotificationPort } from "../../application/port/secondary/EmailNotificationPort.ts";
import type { LoggerPort } from "../../../../shared/ports/LoggerPort.ts";
import { EventEmittingAdapter } from "../../../../shared/infrastructure/adapters/EventEmittingAdapter.ts";
import { WelcomeEmailSentEvent } from "../../domain/events/WelcomeEmailSentEvent.ts";
import { WelcomeEmailFailedEvent } from "../../domain/events/WelcomeEmailFailedEvent.ts";

export class ConsoleEmailNotification
  extends EventEmittingAdapter
  implements EmailNotificationPort
{
  private readonly logger: LoggerPort;

  constructor(logger: LoggerPort) {
    super();
    this.logger = logger;
  }

  public async sendWelcomeEmail(
    email: string,
    userId: string,
    causationId: string | null,
  ): Promise<void> {
    try {
      this.logger.info("Sending welcome email", { email, userId });
      this.addDomainEvent(new WelcomeEmailSentEvent(userId, email, causationId));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.addDomainEvent(new WelcomeEmailFailedEvent(userId, email, errorMessage, causationId));
    }
  }
}
