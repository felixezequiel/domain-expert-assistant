import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CreateUserCommand } from "./CreateUserCommand.ts";

describe("CreateUserCommand", () => {
  it("should create a command from primitive values via factory", () => {
    const command = CreateUserCommand.of("user-1", "John Doe", "john@example.com");

    assert.equal(command.userId.value, "user-1");
    assert.equal(command.name, "John Doe");
    assert.equal(command.email.value, "john@example.com");
  });

  it("should throw when email is invalid", () => {
    assert.throws(() => CreateUserCommand.of("user-1", "John Doe", "invalid"), {
      message: "Invalid email format: invalid",
    });
  });

  it("should throw when userId is empty", () => {
    assert.throws(() => CreateUserCommand.of("", "John Doe", "john@example.com"), {
      message: "Identifier value cannot be empty",
    });
  });
});
