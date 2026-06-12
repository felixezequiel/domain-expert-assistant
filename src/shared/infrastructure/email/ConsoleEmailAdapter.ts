import type { EmailPort, SendEmailRequest } from "../../ports/EmailPort.ts";
import type { LoggerPort } from "../../ports/LoggerPort.ts";

const BODY_PREVIEW_MAX_LENGTH = 100;

export class ConsoleEmailAdapter implements EmailPort {
  private readonly logger: LoggerPort;

  constructor(logger: LoggerPort) {
    this.logger = logger;
  }

  public async send(request: SendEmailRequest): Promise<void> {
    const attachmentCount = request.attachments !== undefined ? request.attachments.length : 0;

    const bodyPreview =
      request.body.length > BODY_PREVIEW_MAX_LENGTH
        ? request.body.substring(0, BODY_PREVIEW_MAX_LENGTH) + "..."
        : request.body;

    this.logger.info("Email sent (console adapter)", {
      recipients: request.recipients,
      subject: request.subject,
      bodyPreview,
      hasHtml: request.html !== undefined,
      attachmentCount,
    });
  }
}
