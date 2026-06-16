import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TrackerCredentialUsageStager } from "./TrackerCredentialUsageStager.ts";
import { AggregateTracker } from "../../../../shared/infrastructure/persistence/AggregateTracker.ts";
import { ConsumerCredential } from "../../../identity/domain/aggregates/ConsumerCredential.ts";
import { CredentialId } from "../../../identity/domain/identifiers/CredentialId.ts";
import { CredentialScope } from "../../../identity/domain/valueObjects/CredentialScope.ts";
import { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";

function buildCredential(): ConsumerCredential {
  return ConsumerCredential.reconstitute(
    new CredentialId("cred-1"),
    "company-1",
    "key-name",
    "prefix",
    "hash",
    CredentialScope.of(["a"], SensitivityLevel.of("internal")),
    "active",
    "creator",
    new Date("2026-01-01T00:00:00.000Z"),
    null,
  );
}

describe("TrackerCredentialUsageStager", () => {
  it("registers the credential with the active tracker scope", async () => {
    await AggregateTracker.run(async () => {
      AggregateTracker.begin();
      const credential = buildCredential();
      new TrackerCredentialUsageStager().stage(credential);
      const staged = AggregateTracker.peek();
      assert.equal(staged.length, 1);
      assert.equal(staged[0], credential);
    });
  });
});
