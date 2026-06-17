import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { KnowledgeVersionRepository } from "./KnowledgeVersionRepository.ts";
import { createFakeEntityManagerProvider } from "./testing/index.ts";
import { runWithTenant } from "../../../../../../shared/infrastructure/http/context/TenantContext.ts";
import { KnowledgeVersion } from "../../../../domain/entities/KnowledgeVersion.ts";
import { DomainError } from "../../../../../../shared/domain/errors/DomainError.ts";

function buildVersion(itemId: string, versionNumber: number): KnowledgeVersion {
  return new KnowledgeVersion({
    itemId,
    versionNumber,
    title: "Title v" + versionNumber,
    body: "Body.",
    tagIds: ["tag-a"],
    sensitivity: "internal",
    createdBy: "editor-1",
    createdAt: new Date("2026-01-02T03:04:05.000Z"),
  });
}

describe("KnowledgeVersionRepository", () => {
  it("appends a version and finds it by item and number within the same transaction (no flush)", async () => {
    await runWithTenant("company-1", async () => {
      const repo = new KnowledgeVersionRepository(createFakeEntityManagerProvider());
      await repo.append(buildVersion("item-1", 2));

      const found = await repo.findByItemAndNumber("item-1", 2);

      assert.equal(found?.itemId, "item-1");
      assert.equal(found?.versionNumber, 2);
      assert.equal(found?.title, "Title v2");
      assert.equal(await repo.findByItemAndNumber("item-1", 99), null);
    });
  });

  it("lists versions for an item ordered by version number", async () => {
    await runWithTenant("company-1", async () => {
      const repo = new KnowledgeVersionRepository(createFakeEntityManagerProvider());
      await repo.append(buildVersion("item-1", 2));
      await repo.append(buildVersion("item-1", 1));
      await repo.append(buildVersion("item-2", 1));

      const versions = await repo.listByItem("item-1");

      assert.deepEqual(
        versions.map((version) => version.versionNumber),
        [1, 2],
      );
    });
  });

  it("requires a tenant in context to append", async () => {
    const repo = new KnowledgeVersionRepository(createFakeEntityManagerProvider());

    await assert.rejects(
      () => repo.append(buildVersion("item-1", 1)),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, "knowledge.missingTenant");
        assert.equal(error.kind, "validation");
        assert.equal(error.message, "Cannot append a knowledge version without a tenant in context");
        return true;
      },
    );
  });
});
