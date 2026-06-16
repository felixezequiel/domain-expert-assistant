import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ScopeResolver } from "./ScopeResolver.ts";
import { ScopeViolationError } from "../errors.ts";
import { CredentialScope } from "../../../identity/domain/valueObjects/CredentialScope.ts";
import { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";

function credentialScope(
  collectionIds: ReadonlyArray<string>,
  ceiling: string,
): CredentialScope {
  return CredentialScope.of(collectionIds, SensitivityLevel.of(ceiling));
}

describe("ScopeResolver", () => {
  const resolver = new ScopeResolver();

  it("with no request filter, the effective scope is the whole credential scope", () => {
    const effective = resolver.resolve(credentialScope(["a", "b"], "confidential"), {});
    assert.deepEqual([...effective.collectionIds].sort(), ["a", "b"]);
    assert.equal(effective.sensitivityCeiling, "confidential");
  });

  it("narrows the collection list to the requested subset (intersection)", () => {
    const effective = resolver.resolve(credentialScope(["a", "b", "c"], "internal"), {
      collectionIds: ["b", "c"],
    });
    assert.deepEqual([...effective.collectionIds].sort(), ["b", "c"]);
  });

  it("throws ScopeViolationError when the request names a collection outside the credential", () => {
    assert.throws(
      () => resolver.resolve(credentialScope(["a"], "internal"), { collectionIds: ["a", "x"] }),
      (error: unknown) => {
        assert.ok(error instanceof ScopeViolationError);
        assert.equal(error.collectionId, "x");
        return true;
      },
    );
  });

  it("the request may only lower the sensitivity ceiling (min of credential and request)", () => {
    const lowered = resolver.resolve(credentialScope(["a"], "confidential"), {
      sensitivityCeiling: "internal",
    });
    assert.equal(lowered.sensitivityCeiling, "internal");
  });

  it("a request asking for a HIGHER ceiling than the credential is capped at the credential ceiling", () => {
    const capped = resolver.resolve(credentialScope(["a"], "internal"), {
      sensitivityCeiling: "confidential",
    });
    assert.equal(capped.sensitivityCeiling, "internal");
  });

  it("an empty credential allowlist yields an empty effective scope (fail-closed, not 'all')", () => {
    const effective = resolver.resolve(credentialScope([], "internal"), {});
    assert.deepEqual(effective.collectionIds, []);
  });

  it("a request narrowing an empty credential to a named collection is a scope violation", () => {
    assert.throws(
      () => resolver.resolve(credentialScope([], "internal"), { collectionIds: ["a"] }),
      ScopeViolationError,
    );
  });

  it("permits returns false for a collection outside the effective scope", () => {
    const effective = resolver.resolve(credentialScope(["a", "b"], "internal"), {
      collectionIds: ["a"],
    });
    assert.equal(resolver.permits(effective, "a", "internal"), true);
    assert.equal(resolver.permits(effective, "b", "internal"), false);
  });

  it("permits returns false for an item above the effective sensitivity ceiling", () => {
    const effective = resolver.resolve(credentialScope(["a"], "internal"), {});
    assert.equal(resolver.permits(effective, "a", "internal"), true);
    assert.equal(resolver.permits(effective, "a", "confidential"), false);
    assert.equal(resolver.permits(effective, "a", "public"), true);
  });
});
