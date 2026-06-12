import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AddressId } from "./AddressId.ts";

describe("AddressId", () => {
  it("should create an AddressId with a given value", () => {
    const addressId = new AddressId("address-123");

    assert.equal(addressId.value, "address-123");
  });

  it("should generate a unique value when no value is provided", () => {
    const addressId = new AddressId();

    assert.ok(addressId.value.length > 0);
  });

  it("should be equal to another AddressId with the same value", () => {
    const firstAddressId = new AddressId("address-123");
    const secondAddressId = new AddressId("address-123");

    assert.ok(firstAddressId.equals(secondAddressId));
  });

  it("should not be equal to a different AddressId", () => {
    const firstAddressId = new AddressId("address-123");
    const secondAddressId = new AddressId("address-456");

    assert.ok(!firstAddressId.equals(secondAddressId));
  });
});
