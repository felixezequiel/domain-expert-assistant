import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { KnowledgeItemMapper } from "./KnowledgeItemMapper.ts";
import { KnowledgeItem } from "../../../../domain/aggregates/KnowledgeItem.ts";
import { KnowledgeItemId } from "../../../../domain/identifiers/KnowledgeItemId.ts";
import { CollectionId } from "../../../../domain/identifiers/CollectionId.ts";
import { TagId } from "../../../../domain/identifiers/TagId.ts";
import { Title } from "../../../../domain/valueObjects/Title.ts";
import { KnowledgeBody } from "../../../../domain/valueObjects/KnowledgeBody.ts";
import { SensitivityLevel } from "../../../../../../shared/domain/valueObjects/SensitivityLevel.ts";

describe("KnowledgeItemMapper", () => {
  it("round-trips a published item with tags through the ORM entity", () => {
    const original = KnowledgeItem.reconstitute({
      id: new KnowledgeItemId("item-1"),
      companyId: "company-1",
      collectionId: new CollectionId("collection-1"),
      title: new Title("How to deploy"),
      body: new KnowledgeBody("Run the pipeline."),
      tagIds: [new TagId("tag-a"), new TagId("tag-b")],
      sensitivity: SensitivityLevel.of("confidential"),
      status: "published",
      currentVersionNumber: 3,
      publishedVersionNumber: 2,
      authorId: "author-1",
      lastEditorId: "editor-1",
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
    });

    const entity = KnowledgeItemMapper.toOrmEntity(original);
    assert.equal(entity.tagIds, "tag-a,tag-b");
    assert.equal(entity.sensitivity, "confidential");
    assert.equal(entity.publishedVersionNumber, 2);

    const domain = KnowledgeItemMapper.toDomain(entity);
    assert.equal(domain.id.value, "item-1");
    assert.equal(domain.companyId, "company-1");
    assert.equal(domain.collectionId.value, "collection-1");
    assert.equal(domain.title.value, "How to deploy");
    assert.equal(domain.body.value, "Run the pipeline.");
    assert.deepEqual(
      domain.tagIds.map((tagId) => tagId.value),
      ["tag-a", "tag-b"],
    );
    assert.equal(domain.sensitivity.name, "confidential");
    assert.equal(domain.status, "published");
    assert.equal(domain.currentVersionNumber, 3);
    assert.equal(domain.publishedVersionNumber, 2);
    assert.equal(domain.authorId, "author-1");
    assert.equal(domain.lastEditorId, "editor-1");
    assert.equal(domain.createdAt.toISOString(), "2026-01-02T03:04:05.000Z");
  });

  it("round-trips a tagless draft (empty tag list, null published pointer)", () => {
    const original = KnowledgeItem.reconstitute({
      id: new KnowledgeItemId("item-2"),
      companyId: "company-1",
      collectionId: new CollectionId("collection-1"),
      title: new Title("Draft"),
      body: new KnowledgeBody("Work in progress."),
      tagIds: [],
      sensitivity: SensitivityLevel.of("public"),
      status: "draft",
      currentVersionNumber: 1,
      publishedVersionNumber: null,
      authorId: "author-1",
      lastEditorId: "author-1",
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
    });

    const entity = KnowledgeItemMapper.toOrmEntity(original);
    assert.equal(entity.tagIds, "");
    assert.equal(entity.publishedVersionNumber, null);

    const domain = KnowledgeItemMapper.toDomain(entity);
    assert.deepEqual(domain.tagIds, []);
    assert.equal(domain.publishedVersionNumber, null);
    assert.equal(domain.status, "draft");
  });
});
