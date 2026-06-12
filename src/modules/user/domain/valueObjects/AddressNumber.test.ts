import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AddressNumber } from "./AddressNumber.ts";

describe("AddressNumber", () => {
  it("should create an address number with a valid value", () => {
    const addressNumber = new AddressNumber("123");

    assert.equal(addressNumber.value, "123");
  });

  it("should allow empty value for rural addresses", () => {
    const addressNumber = new AddressNumber("");

    assert.equal(addressNumber.value, "");
  });

  it("should be equal to another AddressNumber with the same value", () => {
    const firstNumber = new AddressNumber("123");
    const secondNumber = new AddressNumber("123");

    assert.ok(firstNumber.equals(secondNumber));
  });

  it("should not be equal to an AddressNumber with a different value", () => {
    const firstNumber = new AddressNumber("123");
    const secondNumber = new AddressNumber("456");

    assert.ok(!firstNumber.equals(secondNumber));
  });
});
