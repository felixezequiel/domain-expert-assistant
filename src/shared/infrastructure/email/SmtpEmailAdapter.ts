import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { EmailPort, SendEmailRequest } from "../../ports/EmailPort.ts";
import type { LoggerPort } from "../../ports/LoggerPort.ts";

export interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly user: string;
  readonly pass: string;
  readonly fromAddress: string;
  readonly fromName: string;
}

const DEFAULT_SMTP_PORT = 587;
const DEFAULT_FROM_NAME = "App";

interface MinimalTransporter {
  sendMail(options: Record<string, unknown>): Promise<unknown>;
}

export class SmtpEmailAdapter implements EmailPort {
  private readonly transporter: MinimalTransporter;
  private readonly fromHeader: string;
  private readonly logger: LoggerPort;

  private constructor(config: SmtpConfig, transporter: MinimalTransporter, logger: LoggerPort) {
    this.transporter = transporter;
    this.fromHeader = `"${config.fromName}" <${config.fromAddress}>`;
    this.logger = logger;
  }

  public static create(config: SmtpConfig, logger: LoggerPort): SmtpEmailAdapter {
    const transporter: Transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    return new SmtpEmailAdapter(config, transporter, logger);
  }

  public static createWithTransporter(
    config: SmtpConfig,
    transporter: MinimalTransporter,
    logger: LoggerPort,
  ): SmtpEmailAdapter {
    return new SmtpEmailAdapter(config, transporter, logger);
  }

  public static createFromEnv(
    env: Record<string, string | undefined>,
    logger: LoggerPort,
  ): SmtpEmailAdapter | undefined {
    const host = env.SMTP_HOST;
    if (host === undefined || host === "") {
      return undefined;
    }

    const fromAddress = env.SMTP_FROM_ADDRESS;
    if (fromAddress === undefined || fromAddress === "") {
      return undefined;
    }

    const config: SmtpConfig = {
      host,
      port: Number(env.SMTP_PORT ?? DEFAULT_SMTP_PORT),
      secure: env.SMTP_SECURE === "true",
      user: env.SMTP_USER ?? "",
      pass: env.SMTP_PASS ?? "",
      fromAddress,
      fromName: env.SMTP_FROM_NAME ?? DEFAULT_FROM_NAME,
    };

    return SmtpEmailAdapter.create(config, logger);
  }

  public async send(request: SendEmailRequest): Promise<void> {
    const mailOptions: Record<string, unknown> = {
      from: this.fromHeader,
      to: [...request.recipients].join(", "),
      subject: request.subject,
      text: request.body,
    };

    if (request.html !== undefined) {
      mailOptions.html = request.html;
    }

    if (request.attachments !== undefined) {
      mailOptions.attachments = request.attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
      }));
    }

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.info("Email sent via SMTP", {
        recipients: request.recipients,
        subject: request.subject,
      });
    } catch (error) {
      this.logger.error("Failed to send email via SMTP", {
        recipients: request.recipients,
        subject: request.subject,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
