import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Street } from "./Street.ts";

describe("Street", () => {
  it("should create a street with a valid value", () => {
    const street = new Street("Rua das Flores");

    assert.equal(street.value, "Rua das Flores");
  });

  it("should throw when street is empty", () => {
    assert.throws(() => new Street(""), {
      message: "Street cannot be empty",
    });
  });

  it("should be equal to another Street with the same value", () => {
    const firstStreet = new Street("Rua das Flores");
    const secondStreet = new Street("Rua das Flores");

    assert.ok(firstStreet.equals(secondStreet));
  });

  it("should not be equal to a Street with a different value", () => {
    const firstStreet = new Street("Rua A");
    const secondStreet = new Street("Rua B");

    assert.ok(!firstStreet.equals(secondStreet));
  });
});
