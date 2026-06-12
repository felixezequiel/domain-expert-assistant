import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ConsoleEmailAdapter } from "./ConsoleEmailAdapter.ts";
import type { LoggerPort } from "../../ports/LoggerPort.ts";
import type { SendEmailRequest } from "../../ports/EmailPort.ts";

class SpyLogger implements LoggerPort {
  public readonly infoCalls: Array<{
    message: string;
    context?: Record<string, unknown> | undefined;
  }> = [];

  public info(message: string, context?: Record<string, unknown>): void {
    this.infoCalls.push({ message, context: context ?? undefined });
  }

  public warn(): void {}
  public error(): void {}
  public debug(): void {}
}

describe("ConsoleEmailAdapter", () => {
  let spyLogger: SpyLogger;
  let adapter: ConsoleEmailAdapter;

  beforeEach(() => {
    spyLogger = new SpyLogger();
    adapter = new ConsoleEmailAdapter(spyLogger);
  });

  it("should log email details when send is called", async () => {
    const request: SendEmailRequest = {
      recipients: ["user@example.com"],
      subject: "Welcome",
      body: "Hello!",
    };

    await adapter.send(request);

    assert.equal(spyLogger.infoCalls.length, 1);
    const logEntry = spyLogger.infoCalls[0]!;
    assert.equal(logEntry.message, "Email sent (console adapter)");
    assert.deepStrictEqual(logEntry.context!.recipients, ["user@example.com"]);
    assert.equal(logEntry.context!.subject, "Welcome");
    assert.equal(logEntry.context!.attachmentCount, 0);
  });

  it("should log multiple recipients", async () => {
    const request: SendEmailRequest = {
      recipients: ["a@example.com", "b@example.com", "c@example.com"],
      subject: "Report",
      body: "Attached is your report.",
    };

    await adapter.send(request);

    const logEntry = spyLogger.infoCalls[0]!;
    assert.deepStrictEqual(logEntry.context!.recipients, [
      "a@example.com",
      "b@example.com",
      "c@example.com",
    ]);
  });

  it("should log attachment count when attachments are provided", async () => {
    const request: SendEmailRequest = {
      recipients: ["user@example.com"],
      subject: "Report with attachments",
      body: "See attached.",
      attachments: [
        {
          filename: "report.pdf",
          content: Buffer.from("pdf-content"),
          contentType: "application/pdf",
        },
        { filename: "data.csv", content: Buffer.from("csv-content"), contentType: "text/csv" },
      ],
    };

    await adapter.send(request);

    const logEntry = spyLogger.infoCalls[0]!;
    assert.equal(logEntry.context!.attachmentCount, 2);
  });

  it("should truncate long body in log context", async () => {
    const longBody = "A".repeat(300);
    const request: SendEmailRequest = {
      recipients: ["user@example.com"],
      subject: "Long email",
      body: longBody,
    };

    await adapter.send(request);

    const logEntry = spyLogger.infoCalls[0]!;
    const loggedBody = logEntry.context!.bodyPreview as string;
    assert.ok(loggedBody.length <= 103);
    assert.ok(loggedBody.endsWith("..."));
  });

  it("should not truncate short body in log context", async () => {
    const request: SendEmailRequest = {
      recipients: ["user@example.com"],
      subject: "Short email",
      body: "Hello!",
    };

    await adapter.send(request);

    const logEntry = spyLogger.infoCalls[0]!;
    assert.equal(logEntry.context!.bodyPreview, "Hello!");
  });
});
