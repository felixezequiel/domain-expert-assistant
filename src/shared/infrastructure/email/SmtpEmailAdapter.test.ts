import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { SmtpEmailAdapter } from "./SmtpEmailAdapter.ts";
import type { SmtpConfig } from "./SmtpEmailAdapter.ts";
import type { LoggerPort } from "../../ports/LoggerPort.ts";

class SpyLogger implements LoggerPort {
  public readonly infoCalls: Array<{
    message: string;
    context?: Record<string, unknown> | undefined;
  }> = [];
  public readonly errorCalls: Array<{
    message: string;
    context?: Record<string, unknown> | undefined;
  }> = [];

  public info(message: string, context?: Record<string, unknown>): void {
    this.infoCalls.push({ message, context: context ?? undefined });
  }

  public error(message: string, context?: Record<string, unknown>): void {
    this.errorCalls.push({ message, context: context ?? undefined });
  }

  public warn(): void {}
  public debug(): void {}
}

interface CapturedMailOptions {
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
  readonly attachments?: ReadonlyArray<{ filename: string; content: Buffer; contentType: string }>;
}

function createSpyTransporter(): {
  sendMailCalls: Array<CapturedMailOptions>;
  sendMailShouldReject: boolean;
  sendMailError: Error;
  transporter: { sendMail(options: Record<string, unknown>): Promise<unknown> };
} {
  const state = {
    sendMailCalls: [] as Array<CapturedMailOptions>,
    sendMailShouldReject: false,
    sendMailError: new Error("SMTP connection failed"),
    transporter: {
      async sendMail(options: Record<string, unknown>): Promise<unknown> {
        state.sendMailCalls.push(options as unknown as CapturedMailOptions);
        if (state.sendMailShouldReject) {
          throw state.sendMailError;
        }
        return {};
      },
    },
  };
  return state;
}

const VALID_CONFIG: SmtpConfig = {
  host: "smtp.example.com",
  port: 587,
  secure: false,
  user: "test@example.com",
  pass: "smtp-key-123",
  fromAddress: "noreply@example.com",
  fromName: "App",
};

describe("SmtpEmailAdapter", () => {
  let spyLogger: SpyLogger;
  let spyTransporterState: ReturnType<typeof createSpyTransporter>;
  let adapter: SmtpEmailAdapter;

  beforeEach(() => {
    spyLogger = new SpyLogger();
    spyTransporterState = createSpyTransporter();
    adapter = SmtpEmailAdapter.createWithTransporter(
      VALID_CONFIG,
      spyTransporterState.transporter,
      spyLogger,
    );
  });

  describe("send", () => {
    it("should send email with correct from, to, subject and body", async () => {
      await adapter.send({
        recipients: ["user@example.com"],
        subject: "Test Subject",
        body: "Hello World",
      });

      assert.equal(spyTransporterState.sendMailCalls.length, 1);
      const call = spyTransporterState.sendMailCalls[0]!;
      assert.equal(call.from, '"App" <noreply@example.com>');
      assert.equal(call.to, "user@example.com");
      assert.equal(call.subject, "Test Subject");
      assert.equal(call.text, "Hello World");
    });

    it("should join multiple recipients with comma", async () => {
      await adapter.send({
        recipients: ["a@example.com", "b@example.com"],
        subject: "Test",
        body: "Body",
      });

      const call = spyTransporterState.sendMailCalls[0]!;
      assert.equal(call.to, "a@example.com, b@example.com");
    });

    it("should send email with attachments", async () => {
      await adapter.send({
        recipients: ["user@example.com"],
        subject: "Report",
        body: "See attached.",
        attachments: [
          { filename: "report.pdf", content: Buffer.from("pdf"), contentType: "application/pdf" },
          { filename: "data.csv", content: Buffer.from("csv"), contentType: "text/csv" },
        ],
      });

      const call = spyTransporterState.sendMailCalls[0]!;
      assert.equal(call.attachments?.length, 2);
      assert.equal(call.attachments![0]!.filename, "report.pdf");
      assert.equal(call.attachments![0]!.contentType, "application/pdf");
      assert.equal(call.attachments![1]!.filename, "data.csv");
    });

    it("should send email without attachments when none provided", async () => {
      await adapter.send({
        recipients: ["user@example.com"],
        subject: "No Attachments",
        body: "Plain email",
      });

      const call = spyTransporterState.sendMailCalls[0]!;
      assert.equal(call.attachments, undefined);
    });

    it("should send email with html content when provided", async () => {
      const htmlContent = "<h1>Report</h1>";

      await adapter.send({
        recipients: ["user@example.com"],
        subject: "Report",
        body: "Fallback text",
        html: htmlContent,
      });

      const call = spyTransporterState.sendMailCalls[0]!;
      assert.equal(call.text, "Fallback text");
      assert.equal((call as unknown as Record<string, unknown>).html, htmlContent);
    });

    it("should not include html field when html is not provided", async () => {
      await adapter.send({
        recipients: ["user@example.com"],
        subject: "Plain",
        body: "No HTML",
      });

      const call = spyTransporterState.sendMailCalls[0]!;
      assert.equal((call as unknown as Record<string, unknown>).html, undefined);
    });

    it("should log success after sending", async () => {
      await adapter.send({
        recipients: ["user@example.com"],
        subject: "Test",
        body: "Body",
      });

      assert.equal(spyLogger.infoCalls.length, 1);
      const logEntry = spyLogger.infoCalls[0]!;
      assert.equal(logEntry.message, "Email sent via SMTP");
      assert.deepStrictEqual(logEntry.context!.recipients, ["user@example.com"]);
      assert.equal(logEntry.context!.subject, "Test");
    });

    it("should throw and log error when transporter fails", async () => {
      spyTransporterState.sendMailShouldReject = true;

      await assert.rejects(
        () =>
          adapter.send({
            recipients: ["user@example.com"],
            subject: "Test",
            body: "Body",
          }),
        (error: Error) => {
          assert.equal(error.message, "SMTP connection failed");
          return true;
        },
      );

      assert.equal(spyLogger.errorCalls.length, 1);
      const logEntry = spyLogger.errorCalls[0]!;
      assert.equal(logEntry.message, "Failed to send email via SMTP");
      assert.deepStrictEqual(logEntry.context!.recipients, ["user@example.com"]);
    });
  });

  describe("createFromEnv", () => {
    it("should return undefined when SMTP_HOST is not set", () => {
      const result = SmtpEmailAdapter.createFromEnv({}, spyLogger);

      assert.equal(result, undefined);
    });

    it("should create adapter when all SMTP env vars are set", () => {
      const env = {
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: "587",
        SMTP_USER: "test@example.com",
        SMTP_PASS: "key-123",
        SMTP_FROM_ADDRESS: "noreply@example.com",
        SMTP_FROM_NAME: "App",
      };

      const result = SmtpEmailAdapter.createFromEnv(env, spyLogger);

      assert.notEqual(result, undefined);
    });

    it("should return undefined when SMTP_FROM_ADDRESS is missing", () => {
      const env = {
        SMTP_HOST: "smtp.example.com",
        SMTP_USER: "test@example.com",
        SMTP_PASS: "key-123",
      };

      const result = SmtpEmailAdapter.createFromEnv(env, spyLogger);

      assert.equal(result, undefined);
    });
  });
});
