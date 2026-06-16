import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { IssueConsumerCredentialUseCase } from "./IssueConsumerCredentialUseCase.ts";
import { IssueConsumerCredentialCommand } from "../command/IssueConsumerCredentialCommand.ts";
import { FakeConsumerCredentialRepository, FakeOpaqueSecret } from "../testDoubles/index.ts";
import { runWithActor } from "../../../../shared/application/context/ActorContext.ts";

const ADMIN_SCOPE = {
  companyId: "company-1",
  actorId: "admin-1",
  actorType: "user" as const,
  roles: ["admin" as const],
};

const COMMAND = IssueConsumerCredentialCommand.of("cred-1", "Support bot", ["col-1"], "internal");

describe("IssueConsumerCredentialUseCase", () => {
  it("declares the admin role requirement", () => {
    const useCase = new IssueConsumerCredentialUseCase(
      new FakeConsumerCredentialRepository(),
      new FakeOpaqueSecret(),
    );
    assert.deepEqual([...useCase.requiredRoles], ["admin"]);
  });

  it("issues an active credential storing only prefix + hash and returns the secret once", async () => {
    const useCase = new IssueConsumerCredentialUseCase(
      new FakeConsumerCredentialRepository(),
      new FakeOpaqueSecret(),
    );

    const result = await runWithActor(ADMIN_SCOPE, () => useCase.execute(COMMAND));

    assert.equal(result.secret, "tok-1");
    assert.equal(result.credential.keyPrefix, "pre-1");
    assert.equal(result.credential.secretHash, "H:tok-1");
    assert.equal(result.credential.companyId, "company-1");
    assert.equal(result.credential.createdBy, "admin-1");
    assert.equal(result.credential.isActive(), true);
  });

  it("fails without a tenant/actor in the context", async () => {
    const useCase = new IssueConsumerCredentialUseCase(
      new FakeConsumerCredentialRepository(),
      new FakeOpaqueSecret(),
    );

    await assert.rejects(() => useCase.execute(COMMAND), /without a tenant\/actor/);
  });
});
