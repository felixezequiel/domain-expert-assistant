import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AuthenticateConsumerUseCase } from "./AuthenticateConsumerUseCase.ts";
import { FakeConsumerCredentialRepository, FakeOpaqueSecret } from "../testDoubles/index.ts";
import { ConsumerCredential } from "../../domain/aggregates/ConsumerCredential.ts";
import { CredentialId } from "../../domain/identifiers/CredentialId.ts";
import { CredentialScope } from "../../domain/valueObjects/CredentialScope.ts";
import { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";

function credential(): ConsumerCredential {
  // FakeOpaqueSecret hashes "thekey" to "H:thekey".
  return ConsumerCredential.issue(
    new CredentialId("cred-1"),
    "company-1",
    "Bot",
    "pre",
    "H:thekey",
    CredentialScope.of(["col-1"], SensitivityLevel.of("internal")),
    "admin-1",
  );
}

async function build(seed: ConsumerCredential | null) {
  const repo = new FakeConsumerCredentialRepository();
  if (seed !== null) {
    await repo.save(seed);
  }
  return new AuthenticateConsumerUseCase(repo, new FakeOpaqueSecret());
}

describe("AuthenticateConsumerUseCase", () => {
  it("resolves an active credential from a valid key", async () => {
    const useCase = await build(credential());

    const resolved = await useCase.execute("thekey");

    assert.ok(resolved !== null);
    assert.equal(resolved.id.value, "cred-1");
    assert.equal(resolved.scope.sensitivityCeiling.name, "internal");
  });

  it("returns null for an unknown key", async () => {
    const useCase = await build(credential());

    assert.equal(await useCase.execute("wrong"), null);
  });

  it("returns null for a revoked credential", async () => {
    const revoked = credential();
    revoked.revoke();
    const useCase = await build(revoked);

    assert.equal(await useCase.execute("thekey"), null);
  });
});
