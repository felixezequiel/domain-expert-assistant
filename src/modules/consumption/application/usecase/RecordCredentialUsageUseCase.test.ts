import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RecordCredentialUsageUseCase } from "./RecordCredentialUsageUseCase.ts";
import { ConsumerCredential } from "../../../identity/domain/aggregates/ConsumerCredential.ts";
import { CredentialId } from "../../../identity/domain/identifiers/CredentialId.ts";
import { CredentialScope } from "../../../identity/domain/valueObjects/CredentialScope.ts";
import { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";
import type { ConsumerCredentialRepositoryPort } from "../../../identity/application/types.ts";
import type { CredentialUsageStagerPort } from "../types.ts";

class FakeCredentialRepository implements ConsumerCredentialRepositoryPort {
  private readonly byId = new Map<string, ConsumerCredential>();
  public add(credential: ConsumerCredential): void {
    this.byId.set(credential.id.value, credential);
  }
  public async save(): Promise<void> {
    // no-op: persistence happens through the unit of work in production
  }
  public async findById(id: CredentialId): Promise<ConsumerCredential | null> {
    return this.byId.get(id.value) ?? null;
  }
  public async findBySecretHash(): Promise<ConsumerCredential | null> {
    return null;
  }
  public async listByCompany(): Promise<ReadonlyArray<ConsumerCredential>> {
    return [...this.byId.values()];
  }
}

function buildCredential(id: string, companyId: string): ConsumerCredential {
  return ConsumerCredential.reconstitute(
    new CredentialId(id),
    companyId,
    "key-name",
    "prefix",
    "hash",
    CredentialScope.of(["a"], SensitivityLevel.of("internal")),
    "active",
    "creator",
    new Date("2026-01-01T00:00:00.000Z"),
    null,
  );
}

class FakeUsageStager implements CredentialUsageStagerPort {
  public readonly staged: Array<ConsumerCredential> = [];
  public stage(credential: ConsumerCredential): void {
    this.staged.push(credential);
  }
}

describe("RecordCredentialUsageUseCase", () => {
  it("marks the credential used and stages it for persistence (no flush)", async () => {
    const repository = new FakeCredentialRepository();
    const stager = new FakeUsageStager();
    const credential = buildCredential("cred-1", "company-1");
    repository.add(credential);

    const useCase = new RecordCredentialUsageUseCase(repository, stager);
    await useCase.execute({ credentialId: "cred-1", at: new Date("2026-06-16T12:00:00.000Z") });

    assert.equal(credential.lastUsedAt?.toISOString(), "2026-06-16T12:00:00.000Z");
    assert.equal(stager.staged.length, 1);
    assert.equal(stager.staged[0], credential);
  });

  it("is a no-op when the credential cannot be found", async () => {
    const repository = new FakeCredentialRepository();
    const stager = new FakeUsageStager();
    const useCase = new RecordCredentialUsageUseCase(repository, stager);
    await useCase.execute({ credentialId: "missing", at: new Date() });
    assert.equal(stager.staged.length, 0);
  });
});
