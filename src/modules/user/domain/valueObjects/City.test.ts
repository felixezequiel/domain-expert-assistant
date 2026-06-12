import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { City } from "./City.ts";

describe("City", () => {
  it("should create a city with a valid value", () => {
    const city = new City("Sao Paulo");

    assert.equal(city.value, "Sao Paulo");
  });

  it("should throw when city is empty", () => {
    assert.throws(() => new City(""), {
      message: "City cannot be empty",
    });
  });

  it("should be equal to another City with the same value", () => {
    const firstCity = new City("Sao Paulo");
    const secondCity = new City("Sao Paulo");

    assert.ok(firstCity.equals(secondCity));
  });

  it("should not be equal to a City with a different value", () => {
    const firstCity = new City("Sao Paulo");
    const secondCity = new City("Rio de Janeiro");

    assert.ok(!firstCity.equals(secondCity));
  });
});
