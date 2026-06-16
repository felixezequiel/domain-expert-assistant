import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RevokeConsumerCredentialUseCase } from "./RevokeConsumerCredentialUseCase.ts";
import { RevokeConsumerCredentialCommand } from "../command/RevokeConsumerCredentialCommand.ts";
import { FakeConsumerCredentialRepository } from "../testDoubles/index.ts";
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
    "pre",
    "hash",
    CredentialScope.of(["col-1"], SensitivityLevel.of("public")),
    "admin-1",
  );
}

describe("RevokeConsumerCredentialUseCase", () => {
  it("revokes a credential of the actor's tenant", async () => {
    const repo = new FakeConsumerCredentialRepository();
    await repo.save(credential("company-1"));
    const useCase = new RevokeConsumerCredentialUseCase(repo);

    const revoked = await runWithActor(ADMIN_SCOPE, () =>
      useCase.execute(RevokeConsumerCredentialCommand.of("cred-1")),
    );

    assert.equal(revoked.status, "revoked");
    assert.equal(revoked.isActive(), false);
  });

  it("does not revoke a credential of another tenant", async () => {
    const repo = new FakeConsumerCredentialRepository();
    await repo.save(credential("company-OTHER"));
    const useCase = new RevokeConsumerCredentialUseCase(repo);

    await assert.rejects(
      () => runWithActor(ADMIN_SCOPE, () => useCase.execute(RevokeConsumerCredentialCommand.of("cred-1"))),
      /not found/,
    );
  });
});
