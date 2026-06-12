import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ConsoleEmailNotification } from "./ConsoleEmailNotification.ts";
import { EventEmittingAdapter } from "../../../../shared/infrastructure/adapters/EventEmittingAdapter.ts";
import { WelcomeEmailSentEvent } from "../../domain/events/WelcomeEmailSentEvent.ts";
import { WelcomeEmailFailedEvent } from "../../domain/events/WelcomeEmailFailedEvent.ts";
import type { LoggerPort } from "../../../../shared/ports/LoggerPort.ts";

class SpyLogger implements LoggerPort {
  public infoMessages: Array<{ message: string; context?: Record<string, unknown> | undefined }> =
    [];
  public errorMessages: Array<{ message: string; context?: Record<string, unknown> | undefined }> =
    [];

  public info(message: string, context?: Record<string, unknown>): void {
    this.infoMessages.push({ message, context });
  }

  public warn(): void {}

  public error(message: string, context?: Record<string, unknown>): void {
    this.errorMessages.push({ message, context });
  }

  public debug(): void {}
}

class FailingLogger implements LoggerPort {
  public info(): void {
    throw new Error("SMTP connection refused");
  }

  public warn(): void {}
  public error(): void {}
  public debug(): void {}
}

describe("ConsoleEmailNotification", () => {
  afterEach(() => {
    EventEmittingAdapter.setOnTrack(null);
  });

  it("should log the welcome email details", async () => {
    const spyLogger = new SpyLogger();
    const notification = new ConsoleEmailNotification(spyLogger);

    await notification.sendWelcomeEmail("john@example.com", "user-123", null);

    assert.equal(spyLogger.infoMessages.length, 1);
    assert.equal(spyLogger.infoMessages[0]!.message, "Sending welcome email");
    assert.deepEqual(spyLogger.infoMessages[0]!.context, {
      email: "john@example.com",
      userId: "user-123",
    });
  });

  it("should emit WelcomeEmailSentEvent on success", async () => {
    const spyLogger = new SpyLogger();
    const notification = new ConsoleEmailNotification(spyLogger);

    await notification.sendWelcomeEmail("john@example.com", "user-123", null);

    const events = notification.getDomainEvents();

    assert.equal(events.length, 1);
    assert.ok(events[0] instanceof WelcomeEmailSentEvent);

    const sentEvent = events[0] as WelcomeEmailSentEvent;
    assert.equal(sentEvent.aggregateId, "user-123");
    assert.equal(sentEvent.email, "john@example.com");
  });

  it("should set causationId on WelcomeEmailSentEvent when provided", async () => {
    const spyLogger = new SpyLogger();
    const notification = new ConsoleEmailNotification(spyLogger);
    const causingEventId = randomUUID();

    await notification.sendWelcomeEmail("john@example.com", "user-123", causingEventId);

    const events = notification.getDomainEvents();
    const sentEvent = events[0] as WelcomeEmailSentEvent;

    assert.equal(sentEvent.causationId, causingEventId);
  });

  it("should emit WelcomeEmailFailedEvent on failure", async () => {
    const failingLogger = new FailingLogger();
    const notification = new ConsoleEmailNotification(failingLogger);

    await notification.sendWelcomeEmail("john@example.com", "user-123", null);

    const events = notification.getDomainEvents();

    assert.equal(events.length, 1);
    assert.ok(events[0] instanceof WelcomeEmailFailedEvent);

    const failedEvent = events[0] as WelcomeEmailFailedEvent;
    assert.equal(failedEvent.aggregateId, "user-123");
    assert.equal(failedEvent.email, "john@example.com");
    assert.equal(failedEvent.reason, "SMTP connection refused");
  });

  it("should set causationId on WelcomeEmailFailedEvent when provided", async () => {
    const failingLogger = new FailingLogger();
    const notification = new ConsoleEmailNotification(failingLogger);
    const causingEventId = randomUUID();

    await notification.sendWelcomeEmail("john@example.com", "user-123", causingEventId);

    const events = notification.getDomainEvents();
    const failedEvent = events[0] as WelcomeEmailFailedEvent;

    assert.equal(failedEvent.causationId, causingEventId);
  });

  it("should not throw when email sending fails", async () => {
    const failingLogger = new FailingLogger();
    const notification = new ConsoleEmailNotification(failingLogger);

    await assert.doesNotReject(() =>
      notification.sendWelcomeEmail("john@example.com", "user-123", null),
    );
  });

  it("should be an instance of EventEmittingAdapter", () => {
    const spyLogger = new SpyLogger();
    const notification = new ConsoleEmailNotification(spyLogger);

    assert.ok(notification instanceof EventEmittingAdapter);
  });
});
