import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CompanyId } from "./CompanyId.ts";
import { Identifier } from "./Identifier.ts";

describe("CompanyId", () => {
  it("should create a CompanyId with a given value", () => {
    const companyId = new CompanyId("company-abc-123");

    assert.equal(companyId.value, "company-abc-123");
  });

  it("should generate a unique value when no value is provided", () => {
    const companyId = new CompanyId();

    assert.ok(companyId.value.length > 0);
  });

  it("should throw an error for empty string", () => {
    assert.throws(() => new CompanyId(""), {
      message: "Identifier value cannot be empty",
    });
  });

  it("should be equal to another CompanyId with the same value", () => {
    const firstId = new CompanyId("same");
    const secondId = new CompanyId("same");

    assert.ok(firstId.equals(secondId));
  });

  it("should not be equal to a different CompanyId", () => {
    const firstId = new CompanyId("a");
    const secondId = new CompanyId("b");

    assert.ok(!firstId.equals(secondId));
  });

  it("should not be equal to an Identifier with the same value", () => {
    const companyId = new CompanyId("same-value");
    const genericId = new Identifier("same-value");

    assert.ok(!companyId.equals(genericId));
  });
});
