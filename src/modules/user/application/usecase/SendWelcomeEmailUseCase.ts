import type { SendWelcomeEmailPort } from "../port/primary/SendWelcomeEmailPort.ts";
import type { EmailNotificationPort } from "../port/secondary/EmailNotificationPort.ts";
import type { SendWelcomeEmailCommand } from "../command/SendWelcomeEmailCommand.ts";

export class SendWelcomeEmailUseCase implements SendWelcomeEmailPort {
  private readonly emailNotification: EmailNotificationPort;

  constructor(emailNotification: EmailNotificationPort) {
    this.emailNotification = emailNotification;
  }

  public async execute(command: SendWelcomeEmailCommand): Promise<void> {
    await this.emailNotification.sendWelcomeEmail(
      command.email.value,
      command.userId.value,
      command.causationId,
    );
  }
}
