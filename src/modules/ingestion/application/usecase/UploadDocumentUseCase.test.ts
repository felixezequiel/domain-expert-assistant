import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UploadDocumentUseCase } from "./UploadDocumentUseCase.ts";
import { UploadDocumentCommand } from "../command/IngestionCommands.ts";
import { FakeFileStorage } from "../testDoubles/index.ts";
import { runWithActor } from "../../../../shared/application/context/ActorContext.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

const CURATOR = { companyId: "company-1", actorId: "curator-1", actorType: "user" as const, roles: ["curator" as const] };

describe("UploadDocumentUseCase", () => {
  it("stores the file and creates a pending job scoped to the tenant", async () => {
    const storage = new FakeFileStorage();
    const useCase = new UploadDocumentUseCase(storage);
    const command = UploadDocumentCommand.of("col-1", "policy.md", "text/markdown", Buffer.from("# Hi"));

    const job = await runWithActor(CURATOR, () => useCase.execute(command));

    assert.equal(job.status, "pending");
    assert.equal(job.companyId, "company-1");
    assert.equal(job.createdBy, "curator-1");
    assert.ok(job.storageRef.startsWith("company-1/"));
    // file is retrievable under the same company + ref
    assert.equal((await storage.read("company-1", job.storageRef)).toString(), "# Hi");
  });

  it("requires a tenant/actor in the context (coded internal guard)", async () => {
    const useCase = new UploadDocumentUseCase(new FakeFileStorage());
    const command = UploadDocumentCommand.of("col-1", "policy.md", "text/markdown", Buffer.from("x"));
    await assert.rejects(
      () => useCase.execute(command),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, "ingestion.missingActorContext");
        assert.equal(error.kind, "internal");
        assert.equal(error.message, "Cannot upload a document without a tenant/actor in the context");
        return true;
      },
    );
  });
});
