import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { SendWelcomeEmailCommand } from "./SendWelcomeEmailCommand.ts";

describe("SendWelcomeEmailCommand", () => {
  it("should create a command from primitives using the of() factory", () => {
    const command = SendWelcomeEmailCommand.of("user-123", "john@example.com");

    assert.equal(command.userId.value, "user-123");
    assert.equal(command.email.value, "john@example.com");
  });

  it("should reject an invalid email format", () => {
    assert.throws(() => SendWelcomeEmailCommand.of("user-123", "invalid-email"));
  });

  it("should have causationId as null by default", () => {
    const command = SendWelcomeEmailCommand.of("user-123", "john@example.com");

    assert.equal(command.causationId, null);
  });

  it("should accept a causationId when provided", () => {
    const causingEventId = randomUUID();
    const command = SendWelcomeEmailCommand.of("user-123", "john@example.com", causingEventId);

    assert.equal(command.causationId, causingEventId);
  });
});
