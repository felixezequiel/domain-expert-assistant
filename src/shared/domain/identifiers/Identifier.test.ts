import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Identifier } from "./Identifier.ts";

class OrderId extends Identifier {}
class CustomerId extends Identifier {}

describe("Identifier", () => {
  it("should create an identifier with a given value", () => {
    const id = new OrderId("abc-123");

    assert.equal(id.value, "abc-123");
  });

  it("should generate a unique identifier when no value is provided", () => {
    const id = new OrderId();

    assert.ok(id.value.length > 0);
  });

  it("should generate different values for each new identifier", () => {
    const firstId = new OrderId();
    const secondId = new OrderId();

    assert.notEqual(firstId.value, secondId.value);
  });

  it("should be equal to another identifier with the same value and type", () => {
    const firstId = new OrderId("same-value");
    const secondId = new OrderId("same-value");

    assert.ok(firstId.equals(secondId));
  });

  it("should not be equal to an identifier with a different value", () => {
    const firstId = new OrderId("value-a");
    const secondId = new OrderId("value-b");

    assert.ok(!firstId.equals(secondId));
  });

  it("should not be equal to an identifier of a different type even with same value", () => {
    const orderId = new OrderId("same-value");
    const customerId = new CustomerId("same-value");

    assert.ok(!orderId.equals(customerId));
  });

  it("should throw when created with an empty string", () => {
    assert.throws(() => new OrderId(""), {
      message: "Identifier value cannot be empty",
    });
  });

  it("should return the value as string representation", () => {
    const id = new OrderId("abc-123");

    assert.equal(id.toString(), "abc-123");
  });
});
