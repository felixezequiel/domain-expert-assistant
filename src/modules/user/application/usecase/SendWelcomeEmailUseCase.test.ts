import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { SendWelcomeEmailUseCase } from "./SendWelcomeEmailUseCase.ts";
import { SendWelcomeEmailCommand } from "../command/SendWelcomeEmailCommand.ts";
import type { EmailNotificationPort } from "../port/secondary/EmailNotificationPort.ts";

class FakeEmailNotification implements EmailNotificationPort {
  public sentEmails: Array<{ email: string; userId: string; causationId: string | null }> = [];

  public async sendWelcomeEmail(
    email: string,
    userId: string,
    causationId: string | null,
  ): Promise<void> {
    this.sentEmails.push({ email, userId, causationId });
  }
}

describe("SendWelcomeEmailUseCase", () => {
  it("should send a welcome email using the notification port", async () => {
    const fakeEmailNotification = new FakeEmailNotification();
    const useCase = new SendWelcomeEmailUseCase(fakeEmailNotification);
    const command = SendWelcomeEmailCommand.of("user-123", "john@example.com");

    await useCase.execute(command);

    assert.equal(fakeEmailNotification.sentEmails.length, 1);
    assert.equal(fakeEmailNotification.sentEmails[0]!.email, "john@example.com");
    assert.equal(fakeEmailNotification.sentEmails[0]!.userId, "user-123");
  });

  it("should pass causationId to the notification port", async () => {
    const fakeEmailNotification = new FakeEmailNotification();
    const useCase = new SendWelcomeEmailUseCase(fakeEmailNotification);
    const causingEventId = randomUUID();
    const command = SendWelcomeEmailCommand.of("user-123", "john@example.com", causingEventId);

    await useCase.execute(command);

    assert.equal(fakeEmailNotification.sentEmails[0]!.causationId, causingEventId);
  });

  it("should propagate errors from the notification port", async () => {
    const failingNotification: EmailNotificationPort = {
      sendWelcomeEmail: async () => {
        throw new Error("SMTP connection failed");
      },
    };
    const useCase = new SendWelcomeEmailUseCase(failingNotification);
    const command = SendWelcomeEmailCommand.of("user-123", "john@example.com");

    await assert.rejects(() => useCase.execute(command), { message: "SMTP connection failed" });
  });
});
