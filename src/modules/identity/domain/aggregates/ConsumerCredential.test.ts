import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ConsumerCredential } from "./ConsumerCredential.ts";
import { CredentialId } from "../identifiers/CredentialId.ts";
import { CredentialScope } from "../valueObjects/CredentialScope.ts";
import { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";

function issue(): ConsumerCredential {
  return ConsumerCredential.issue(
    new CredentialId("cred-1"),
    "company-1",
    "Support bot",
    "dea_abcd",
    "hash-1",
    CredentialScope.of(["col-1"], SensitivityLevel.of("internal")),
    "user-admin",
  );
}

describe("ConsumerCredential", () => {
  it("issues as active, storing only keyPrefix + secretHash, emitting Issued", () => {
    const credential = issue();

    assert.equal(credential.status, "active");
    assert.equal(credential.keyPrefix, "dea_abcd");
    assert.equal(credential.secretHash, "hash-1");
    assert.equal(credential.companyId, "company-1");
    assert.equal(credential.isActive(), true);
    assert.equal(credential.getDomainEvents()[0]!.eventName, "ConsumerCredentialIssued");
  });

  it("rotates to a new secret keeping the same scope, emitting Rotated", () => {
    const credential = issue();
    credential.drainDomainEvents();

    credential.rotate("dea_wxyz", "hash-2");

    assert.equal(credential.keyPrefix, "dea_wxyz");
    assert.equal(credential.secretHash, "hash-2");
    assert.deepEqual([...credential.scope.collectionIds], ["col-1"]);
    assert.equal(credential.getDomainEvents()[0]!.eventName, "ConsumerCredentialRotated");
  });

  it("refuses to rotate a revoked credential", () => {
    const credential = issue();
    credential.revoke();

    assert.throws(() => credential.rotate("dea_new", "hash-3"), /revoked/);
  });

  it("revokes and stops authenticating, emitting Revoked", () => {
    const credential = issue();
    credential.drainDomainEvents();

    credential.revoke();

    assert.equal(credential.status, "revoked");
    assert.equal(credential.isActive(), false);
    assert.equal(credential.getDomainEvents()[0]!.eventName, "ConsumerCredentialRevoked");
  });

  it("is idempotent when revoking twice (no second event)", () => {
    const credential = issue();
    credential.revoke();
    credential.drainDomainEvents();

    credential.revoke();
    assert.equal(credential.getDomainEvents().length, 0);
  });

  it("reconstitutes without emitting events", () => {
    const credential = ConsumerCredential.reconstitute(
      new CredentialId("cred-1"),
      "company-1",
      "Support bot",
      "dea_abcd",
      "hash-1",
      CredentialScope.of(["col-1"], SensitivityLevel.of("public")),
      "revoked",
      "user-admin",
      new Date("2026-01-01T00:00:00.000Z"),
      null,
    );

    assert.equal(credential.status, "revoked");
    assert.equal(credential.getDomainEvents().length, 0);
  });
});
