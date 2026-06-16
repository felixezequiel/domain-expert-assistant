import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RotateConsumerCredentialUseCase } from "./RotateConsumerCredentialUseCase.ts";
import { RotateConsumerCredentialCommand } from "../command/RotateConsumerCredentialCommand.ts";
import { FakeConsumerCredentialRepository, FakeOpaqueSecret } from "../testDoubles/index.ts";
import { ConsumerCredential } from "../../domain/aggregates/ConsumerCredential.ts";
import { CredentialId } from "../../domain/identifiers/CredentialId.ts";
import { CredentialScope } from "../../domain/valueObjects/CredentialScope.ts";
import { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";
import { runWithActor } from "../../../../shared/application/context/ActorContext.ts";

const ADMIN_SCOPE = { companyId: "company-1", actorId: "admin-1", actorType: "user" as const, roles: ["admin" as const] };

function credential(companyId: string): ConsumerCredential {
  return ConsumerCredential.issue(
    new CredentialId("cred-1"),
    companyId,
    "Bot",
    "old-prefix",
    "old-hash",
    CredentialScope.of(["col-1"], SensitivityLevel.of("internal")),
    "admin-1",
  );
}

describe("RotateConsumerCredentialUseCase", () => {
  it("rotates the secret keeping the scope, returning the new secret once", async () => {
    const repo = new FakeConsumerCredentialRepository();
    await repo.save(credential("company-1"));
    const useCase = new RotateConsumerCredentialUseCase(repo, new FakeOpaqueSecret());

    const result = await runWithActor(ADMIN_SCOPE, () =>
      useCase.execute(RotateConsumerCredentialCommand.of("cred-1")),
    );

    assert.equal(result.secret, "tok-1");
    assert.equal(result.credential.keyPrefix, "pre-1");
    assert.equal(result.credential.secretHash, "H:tok-1");
    assert.deepEqual([...result.credential.scope.collectionIds], ["col-1"]);
  });

  it("does not rotate a credential of another tenant", async () => {
    const repo = new FakeConsumerCredentialRepository();
    await repo.save(credential("company-OTHER"));
    const useCase = new RotateConsumerCredentialUseCase(repo, new FakeOpaqueSecret());

    await assert.rejects(
      () => runWithActor(ADMIN_SCOPE, () => useCase.execute(RotateConsumerCredentialCommand.of("cred-1"))),
      /not found/,
    );
  });

  it("throws when the credential is missing", async () => {
    const useCase = new RotateConsumerCredentialUseCase(
      new FakeConsumerCredentialRepository(),
      new FakeOpaqueSecret(),
    );

    await assert.rejects(
      () => runWithActor(ADMIN_SCOPE, () => useCase.execute(RotateConsumerCredentialCommand.of("ghost"))),
      /not found/,
    );
  });
});
