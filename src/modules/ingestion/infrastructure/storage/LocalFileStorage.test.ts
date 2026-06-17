import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { LocalFileStorage } from "./LocalFileStorage.ts";
import { runWithActor } from "../../../../shared/application/context/ActorContext.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

function scope(companyId: string) {
  return { companyId, actorId: "system", actorType: "system" as const };
}

describe("LocalFileStorage", () => {
  it("stores and reads back within the owning tenant scope", async () => {
    const storage = new LocalFileStorage();
    const company = "company-" + randomUUID();
    const ref = company + "/" + randomUUID();
    await storage.store(company, ref, Buffer.from("hello world"));

    const bytes = await runWithActor(scope(company), () => storage.read(company, ref));
    assert.equal(bytes.toString(), "hello world");
  });

  it("fail-closed: refuses to read a file outside the current tenant scope", async () => {
    const storage = new LocalFileStorage();
    const company = "company-" + randomUUID();
    const ref = company + "/" + randomUUID();
    await storage.store(company, ref, Buffer.from("secret"));

    await assert.rejects(
      () => runWithActor(scope("another-company"), () => storage.read(company, ref)),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, "ingestion.crossTenantRead");
        assert.equal(error.kind, "internal");
        assert.equal(error.message, "Fail-closed: cannot read a file outside the current tenant scope");
        return true;
      },
    );
  });

  it("rejects path traversal in the storage ref", async () => {
    const storage = new LocalFileStorage();
    await assert.rejects(
      () => runWithActor(scope("c1"), () => storage.read("c1", "../../etc/passwd")),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, "ingestion.invalidStorageReference");
        assert.equal(error.kind, "internal");
        assert.equal(error.message, "Invalid storage reference");
        return true;
      },
    );
  });
});
