import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Address } from "./Address.ts";
import { AddressId } from "../identifiers/AddressId.ts";
import { Street } from "../valueObjects/Street.ts";
import { AddressNumber } from "../valueObjects/AddressNumber.ts";
import { City } from "../valueObjects/City.ts";
import { State } from "../valueObjects/State.ts";
import { ZipCode } from "../valueObjects/ZipCode.ts";

describe("Address", () => {
  it("should create an address with all properties", () => {
    const addressId = new AddressId("addr-1");
    const address = Address.create(
      addressId,
      new Street("Rua das Flores"),
      new AddressNumber("123"),
      new City("Sao Paulo"),
      new State("SP"),
      new ZipCode("01000-000"),
    );

    assert.equal(address.id.value, "addr-1");
    assert.equal(address.street.value, "Rua das Flores");
    assert.equal(address.number.value, "123");
    assert.equal(address.city.value, "Sao Paulo");
    assert.equal(address.state.value, "SP");
    assert.equal(address.zipCode.value, "01000-000");
  });

  it("should throw when street is empty", () => {
    assert.throws(() => new Street(""), { message: "Street cannot be empty" });
  });

  it("should throw when city is empty", () => {
    assert.throws(() => new City(""), { message: "City cannot be empty" });
  });

  it("should throw when state is empty", () => {
    assert.throws(() => new State(""), { message: "State cannot be empty" });
  });

  it("should throw when zipCode is empty", () => {
    assert.throws(() => new ZipCode(""), { message: "ZipCode cannot be empty" });
  });

  it("should be equal to another address with the same id", () => {
    const sameId = new AddressId("addr-1");
    const firstAddress = Address.create(
      sameId,
      new Street("Rua A"),
      new AddressNumber("1"),
      new City("Sao Paulo"),
      new State("SP"),
      new ZipCode("01000-000"),
    );
    const secondAddress = Address.create(
      sameId,
      new Street("Rua B"),
      new AddressNumber("2"),
      new City("Rio de Janeiro"),
      new State("RJ"),
      new ZipCode("20000-000"),
    );

    assert.ok(firstAddress.equals(secondAddress));
  });

  it("should not be equal to an address with a different id", () => {
    const firstAddress = Address.create(
      new AddressId("addr-1"),
      new Street("Rua A"),
      new AddressNumber("1"),
      new City("Sao Paulo"),
      new State("SP"),
      new ZipCode("01000-000"),
    );
    const secondAddress = Address.create(
      new AddressId("addr-2"),
      new Street("Rua A"),
      new AddressNumber("1"),
      new City("Sao Paulo"),
      new State("SP"),
      new ZipCode("01000-000"),
    );

    assert.ok(!firstAddress.equals(secondAddress));
  });

  it("should reconstitute an address without validation", () => {
    const addressId = new AddressId("addr-1");
    const address = Address.reconstitute(
      addressId,
      new Street("Rua das Flores"),
      new AddressNumber("123"),
      new City("Sao Paulo"),
      new State("SP"),
      new ZipCode("01000-000"),
    );

    assert.equal(address.id.value, "addr-1");
    assert.equal(address.street.value, "Rua das Flores");
    assert.equal(address.number.value, "123");
    assert.equal(address.city.value, "Sao Paulo");
    assert.equal(address.state.value, "SP");
    assert.equal(address.zipCode.value, "01000-000");
  });
});
