import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { KnowledgeVersionMapper } from "./KnowledgeVersionMapper.ts";
import { KnowledgeVersion } from "../../../../domain/entities/KnowledgeVersion.ts";

describe("KnowledgeVersionMapper", () => {
  it("round-trips a version, deriving the composite id", () => {
    const original = new KnowledgeVersion({
      itemId: "item-1",
      versionNumber: 2,
      title: "How to deploy",
      body: "Run the pipeline.",
      tagIds: ["tag-a", "tag-b"],
      sensitivity: "internal",
      createdBy: "editor-1",
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
    });

    const entity = KnowledgeVersionMapper.toOrmEntity(original, "company-1");
    assert.equal(entity.id, "item-1:2");
    assert.equal(entity.itemId, "item-1");
    assert.equal(entity.companyId, "company-1");
    assert.equal(entity.tagIds, "tag-a,tag-b");

    const domain = KnowledgeVersionMapper.toDomain(entity);
    assert.equal(domain.itemId, "item-1");
    assert.equal(domain.versionNumber, 2);
    assert.equal(domain.title, "How to deploy");
    assert.equal(domain.body, "Run the pipeline.");
    assert.deepEqual(domain.tagIds, ["tag-a", "tag-b"]);
    assert.equal(domain.sensitivity, "internal");
    assert.equal(domain.createdBy, "editor-1");
    assert.equal(domain.createdAt.toISOString(), "2026-01-02T03:04:05.000Z");
  });

  it("round-trips a version with no tags", () => {
    const original = new KnowledgeVersion({
      itemId: "item-9",
      versionNumber: 1,
      title: "Draft",
      body: "Body.",
      tagIds: [],
      sensitivity: "public",
      createdBy: "author-1",
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
    });

    const entity = KnowledgeVersionMapper.toOrmEntity(original, "company-1");
    assert.equal(entity.id, "item-9:1");
    assert.equal(entity.tagIds, "");

    const domain = KnowledgeVersionMapper.toDomain(entity);
    assert.deepEqual(domain.tagIds, []);
  });
});
