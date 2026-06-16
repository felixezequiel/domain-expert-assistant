import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CredentialScope } from "./CredentialScope.ts";
import { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";

describe("CredentialScope", () => {
  it("holds a deduped collection allowlist and a sensitivity ceiling", () => {
    const scope = CredentialScope.of(["col-1", "col-1", "col-2"], SensitivityLevel.of("internal"));

    assert.deepEqual([...scope.collectionIds].sort(), ["col-1", "col-2"]);
    assert.equal(scope.sensitivityCeiling.name, "internal");
  });

  it("includesCollection reflects the allowlist", () => {
    const scope = CredentialScope.of(["col-1"], SensitivityLevel.of("public"));

    assert.equal(scope.includesCollection("col-1"), true);
    assert.equal(scope.includesCollection("col-2"), false);
  });

  it("permits sensitivity at or below the ceiling only", () => {
    const scope = CredentialScope.of(["col-1"], SensitivityLevel.of("internal"));

    assert.equal(scope.permitsSensitivity(SensitivityLevel.of("public")), true);
    assert.equal(scope.permitsSensitivity(SensitivityLevel.of("internal")), true);
    assert.equal(scope.permitsSensitivity(SensitivityLevel.of("confidential")), false);
  });

  it("is immutable — collectionIds cannot be mutated through the getter", () => {
    const scope = CredentialScope.of(["col-1"], SensitivityLevel.of("public"));

    assert.throws(() => {
      (scope.collectionIds as Array<string>).push("col-2");
    });
  });
});
