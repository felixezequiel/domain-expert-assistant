import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AddAddressCommand } from "./AddAddressCommand.ts";

describe("AddAddressCommand", () => {
  it("should create a command from primitive values via factory", () => {
    const command = AddAddressCommand.of(
      "user-1",
      "addr-1",
      "Rua A",
      "123",
      "Sao Paulo",
      "SP",
      "01000-000",
    );

    assert.equal(command.userId.value, "user-1");
    assert.equal(command.addressId.value, "addr-1");
    assert.equal(command.street.value, "Rua A");
    assert.equal(command.number.value, "123");
    assert.equal(command.city.value, "Sao Paulo");
    assert.equal(command.state.value, "SP");
    assert.equal(command.zipCode.value, "01000-000");
  });

  it("should throw when userId is empty", () => {
    assert.throws(
      () => AddAddressCommand.of("", "addr-1", "Rua A", "123", "Sao Paulo", "SP", "01000-000"),
      { message: "Identifier value cannot be empty" },
    );
  });

  it("should throw when addressId is empty", () => {
    assert.throws(
      () => AddAddressCommand.of("user-1", "", "Rua A", "123", "Sao Paulo", "SP", "01000-000"),
      { message: "Identifier value cannot be empty" },
    );
  });

  it("should throw when street is empty", () => {
    assert.throws(
      () => AddAddressCommand.of("user-1", "addr-1", "", "123", "Sao Paulo", "SP", "01000-000"),
      { message: "Street cannot be empty" },
    );
  });

  it("should throw when city is empty", () => {
    assert.throws(
      () => AddAddressCommand.of("user-1", "addr-1", "Rua A", "123", "", "SP", "01000-000"),
      { message: "City cannot be empty" },
    );
  });

  it("should throw when state is empty", () => {
    assert.throws(
      () => AddAddressCommand.of("user-1", "addr-1", "Rua A", "123", "Sao Paulo", "", "01000-000"),
      { message: "State cannot be empty" },
    );
  });

  it("should throw when zipCode is empty", () => {
    assert.throws(
      () => AddAddressCommand.of("user-1", "addr-1", "Rua A", "123", "Sao Paulo", "SP", ""),
      { message: "ZipCode cannot be empty" },
    );
  });
});
