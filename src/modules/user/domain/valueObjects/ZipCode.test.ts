import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ZipCode } from "./ZipCode.ts";

describe("ZipCode", () => {
  it("should create a zip code with a valid value", () => {
    const zipCode = new ZipCode("01000-000");

    assert.equal(zipCode.value, "01000-000");
  });

  it("should throw when zip code is empty", () => {
    assert.throws(() => new ZipCode(""), {
      message: "ZipCode cannot be empty",
    });
  });

  it("should be equal to another ZipCode with the same value", () => {
    const firstZipCode = new ZipCode("01000-000");
    const secondZipCode = new ZipCode("01000-000");

    assert.ok(firstZipCode.equals(secondZipCode));
  });

  it("should not be equal to a ZipCode with a different value", () => {
    const firstZipCode = new ZipCode("01000-000");
    const secondZipCode = new ZipCode("20000-000");

    assert.ok(!firstZipCode.equals(secondZipCode));
  });
});
