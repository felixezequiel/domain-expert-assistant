import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MikroOrmConsumerCredentialRepository } from "./MikroOrmConsumerCredentialRepository.ts";
import { createFakeEntityManagerProvider } from "./testing/index.ts";
import { ConsumerCredential } from "../../../../domain/aggregates/ConsumerCredential.ts";
import { CredentialId } from "../../../../domain/identifiers/CredentialId.ts";
import { CredentialScope } from "../../../../domain/valueObjects/CredentialScope.ts";
import { SensitivityLevel } from "../../../../../../shared/domain/valueObjects/SensitivityLevel.ts";

function credential(id: string, companyId: string, secretHash: string): ConsumerCredential {
  return ConsumerCredential.issue(
    new CredentialId(id),
    companyId,
    "Bot",
    "pre-" + id,
    secretHash,
    CredentialScope.of(["col-1"], SensitivityLevel.of("internal")),
    "admin-1",
  );
}

describe("MikroOrmConsumerCredentialRepository", () => {
  it("saves and finds by id and secret hash", async () => {
    const repo = new MikroOrmConsumerCredentialRepository(createFakeEntityManagerProvider());
    await repo.save(credential("c1", "company-1", "H:abc"));

    assert.equal((await repo.findById(new CredentialId("c1")))?.keyPrefix, "pre-c1");
    assert.equal((await repo.findBySecretHash("H:abc"))?.id.value, "c1");
    assert.equal(await repo.findBySecretHash("H:none"), null);
  });

  it("lists only a company's credentials", async () => {
    const repo = new MikroOrmConsumerCredentialRepository(createFakeEntityManagerProvider());
    await repo.save(credential("c1", "company-1", "H:1"));
    await repo.save(credential("c2", "company-1", "H:2"));
    await repo.save(credential("c3", "company-OTHER", "H:3"));

    const listed = await repo.listByCompany("company-1");

    assert.deepEqual(listed.map((c) => c.id.value).sort(), ["c1", "c2"]);
  });
});
