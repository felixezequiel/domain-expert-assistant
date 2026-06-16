import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ListConsumerCredentialsUseCase } from "./ListConsumerCredentialsUseCase.ts";
import { FakeConsumerCredentialRepository } from "../testDoubles/index.ts";
import { ConsumerCredential } from "../../domain/aggregates/ConsumerCredential.ts";
import { CredentialId } from "../../domain/identifiers/CredentialId.ts";
import { CredentialScope } from "../../domain/valueObjects/CredentialScope.ts";
import { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";
import { runWithActor } from "../../../../shared/application/context/ActorContext.ts";

const ADMIN_SCOPE = { companyId: "company-1", actorId: "admin-1", actorType: "user" as const, roles: ["admin" as const] };

function credential(id: string, companyId: string): ConsumerCredential {
  return ConsumerCredential.issue(
    new CredentialId(id),
    companyId,
    "Bot " + id,
    "pre-" + id,
    "hash-" + id,
    CredentialScope.of(["col-1"], SensitivityLevel.of("public")),
    "admin-1",
  );
}

describe("ListConsumerCredentialsUseCase", () => {
  it("lists only the tenant's credentials, without exposing the secret hash", async () => {
    const repo = new FakeConsumerCredentialRepository();
    await repo.save(credential("c1", "company-1"));
    await repo.save(credential("c2", "company-1"));
    await repo.save(credential("c3", "company-OTHER"));
    const useCase = new ListConsumerCredentialsUseCase(repo);

    const views = await runWithActor(ADMIN_SCOPE, () => useCase.execute());

    assert.deepEqual(
      views.map((view) => view.id).sort(),
      ["c1", "c2"],
    );
    for (const view of views) {
      assert.equal("secretHash" in view, false);
      assert.equal(view.keyPrefix.startsWith("pre-"), true);
    }
  });

  it("fails without a tenant in the context", async () => {
    const useCase = new ListConsumerCredentialsUseCase(new FakeConsumerCredentialRepository());

    await assert.rejects(() => useCase.execute(), /without a tenant/);
  });
});
