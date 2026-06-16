import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ConsumerCredentialMapper } from "./ConsumerCredentialMapper.ts";
import { ConsumerCredential } from "../../../../domain/aggregates/ConsumerCredential.ts";
import { CredentialId } from "../../../../domain/identifiers/CredentialId.ts";
import { CredentialScope } from "../../../../domain/valueObjects/CredentialScope.ts";
import { SensitivityLevel } from "../../../../../../shared/domain/valueObjects/SensitivityLevel.ts";

describe("ConsumerCredentialMapper", () => {
  it("round-trips a credential including its scope", () => {
    const original = ConsumerCredential.reconstitute(
      new CredentialId("cred-1"),
      "company-1",
      "Bot",
      "pre",
      "hash",
      CredentialScope.of(["col-1", "col-2"], SensitivityLevel.of("internal")),
      "revoked",
      "admin-1",
      new Date("2026-01-02T00:00:00.000Z"),
      new Date("2026-03-04T00:00:00.000Z"),
    );

    const entity = ConsumerCredentialMapper.toOrmEntity(original);
    assert.equal(entity.collectionIds, "col-1,col-2");

    const domain = ConsumerCredentialMapper.toDomain(entity);
    assert.deepEqual([...domain.scope.collectionIds], ["col-1", "col-2"]);
    assert.equal(domain.scope.sensitivityCeiling.name, "internal");
    assert.equal(domain.status, "revoked");
    assert.equal(domain.lastUsedAt?.toISOString(), "2026-03-04T00:00:00.000Z");
  });

  it("maps an empty collection scope to an empty list", () => {
    const original = ConsumerCredential.reconstitute(
      new CredentialId("cred-2"),
      "company-1",
      "Bot",
      "pre",
      "hash",
      CredentialScope.of([], SensitivityLevel.of("public")),
      "active",
      "admin-1",
      new Date("2026-01-02T00:00:00.000Z"),
      null,
    );

    const domain = ConsumerCredentialMapper.toDomain(ConsumerCredentialMapper.toOrmEntity(original));

    assert.deepEqual([...domain.scope.collectionIds], []);
    assert.equal(domain.lastUsedAt, null);
  });
});
