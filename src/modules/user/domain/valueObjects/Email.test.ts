import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Email } from "./Email.ts";

describe("Email", () => {
  it("should create an email with a valid address", () => {
    const email = new Email("user@example.com");

    assert.equal(email.value, "user@example.com");
  });

  it("should throw when email has no @ symbol", () => {
    assert.throws(() => new Email("invalid-email"), {
      message: "Invalid email format: invalid-email",
    });
  });

  it("should throw when email has no domain part", () => {
    assert.throws(() => new Email("user@"), {
      message: "Invalid email format: user@",
    });
  });

  it("should throw when email has no local part", () => {
    assert.throws(() => new Email("@domain.com"), {
      message: "Invalid email format: @domain.com",
    });
  });

  it("should throw when email is empty", () => {
    assert.throws(() => new Email(""), {
      message: "Invalid email format: ",
    });
  });

  it("should be equal to another Email with the same value", () => {
    const firstEmail = new Email("user@example.com");
    const secondEmail = new Email("user@example.com");

    assert.ok(firstEmail.equals(secondEmail));
  });

  it("should not be equal to an Email with a different value", () => {
    const firstEmail = new Email("a@example.com");
    const secondEmail = new Email("b@example.com");

    assert.ok(!firstEmail.equals(secondEmail));
  });
});
