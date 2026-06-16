import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SensitivityLevel, SENSITIVITY_LEVELS } from "./SensitivityLevel.ts";

describe("SensitivityLevel", () => {
  it("defines the three ordered levels", () => {
    assert.deepEqual([...SENSITIVITY_LEVELS], ["public", "internal", "confidential"]);
  });

  it("builds from a valid name and exposes name + rank", () => {
    const level = SensitivityLevel.of("internal");

    assert.equal(level.name, "internal");
    assert.equal(level.rank, 1);
  });

  it("orders public < internal < confidential", () => {
    assert.ok(SensitivityLevel.of("public").rank < SensitivityLevel.of("internal").rank);
    assert.ok(SensitivityLevel.of("internal").rank < SensitivityLevel.of("confidential").rank);
  });

  it("isAtMost is true at or below the ceiling and false above it", () => {
    const internalCeiling = SensitivityLevel.of("internal");

    assert.equal(SensitivityLevel.of("public").isAtMost(internalCeiling), true);
    assert.equal(SensitivityLevel.of("internal").isAtMost(internalCeiling), true);
    assert.equal(SensitivityLevel.of("confidential").isAtMost(internalCeiling), false);
  });

  it("throws on an unknown level", () => {
    assert.throws(() => SensitivityLevel.of("secret"), /Unknown sensitivity level: secret/);
  });

  it("compares equal by value", () => {
    assert.ok(SensitivityLevel.of("public").equals(SensitivityLevel.of("public")));
    assert.ok(!SensitivityLevel.of("public").equals(SensitivityLevel.of("confidential")));
  });
});
