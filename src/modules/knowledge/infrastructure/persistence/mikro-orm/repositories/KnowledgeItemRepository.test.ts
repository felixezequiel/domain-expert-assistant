import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { KnowledgeItemRepository } from "./KnowledgeItemRepository.ts";
import { createFakeEntityManagerProvider } from "./testing/index.ts";
import { KnowledgeItem } from "../../../../domain/aggregates/KnowledgeItem.ts";
import { KnowledgeItemId } from "../../../../domain/identifiers/KnowledgeItemId.ts";
import { CollectionId } from "../../../../domain/identifiers/CollectionId.ts";
import { TagId } from "../../../../domain/identifiers/TagId.ts";
import { Title } from "../../../../domain/valueObjects/Title.ts";
import { KnowledgeBody } from "../../../../domain/valueObjects/KnowledgeBody.ts";
import type { LifecycleStatus } from "../../../../domain/valueObjects/LifecycleStatus.ts";
import { SensitivityLevel } from "../../../../../../shared/domain/valueObjects/SensitivityLevel.ts";

function buildItem(params: {
  id: string;
  collectionId: string;
  status: LifecycleStatus;
  tagIds?: ReadonlyArray<string>;
}): KnowledgeItem {
  return KnowledgeItem.reconstitute({
    id: new KnowledgeItemId(params.id),
    companyId: "company-1",
    collectionId: new CollectionId(params.collectionId),
    title: new Title("Title"),
    body: new KnowledgeBody("Body."),
    tagIds: (params.tagIds ?? []).map((value) => new TagId(value)),
    sensitivity: SensitivityLevel.of("internal"),
    status: params.status,
    currentVersionNumber: 1,
    publishedVersionNumber: params.status === "published" ? 1 : null,
    authorId: "author-1",
    lastEditorId: "author-1",
    createdAt: new Date("2026-01-02T03:04:05.000Z"),
  });
}

describe("KnowledgeItemRepository", () => {
  it("saves then finds an item by id", async () => {
    const repo = new KnowledgeItemRepository(createFakeEntityManagerProvider());
    await repo.save(buildItem({ id: "item-1", collectionId: "collection-1", status: "draft" }));

    const found = await repo.findById(new KnowledgeItemId("item-1"));

    assert.equal(found?.id.value, "item-1");
    assert.equal(await repo.findById(new KnowledgeItemId("missing")), null);
  });

  it("lists by collection and status, treating null filters as wildcards", async () => {
    const repo = new KnowledgeItemRepository(createFakeEntityManagerProvider());
    await repo.save(buildItem({ id: "item-1", collectionId: "collection-1", status: "draft" }));
    await repo.save(buildItem({ id: "item-2", collectionId: "collection-1", status: "published" }));
    await repo.save(buildItem({ id: "item-3", collectionId: "collection-2", status: "draft" }));

    assert.equal((await repo.list({ collectionId: null, status: null })).length, 3);
    assert.equal((await repo.list({ collectionId: "collection-1", status: null })).length, 2);
    assert.equal((await repo.list({ collectionId: null, status: "draft" })).length, 2);

    const filtered = await repo.list({ collectionId: "collection-1", status: "published" });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.id.value, "item-2");
  });

  it("reports whether any item exists in a collection", async () => {
    const repo = new KnowledgeItemRepository(createFakeEntityManagerProvider());
    await repo.save(buildItem({ id: "item-1", collectionId: "collection-1", status: "draft" }));

    assert.equal(await repo.existsInCollection("collection-1"), true);
    assert.equal(await repo.existsInCollection("collection-2"), false);
  });

  it("reports whether a tag is in use, matching exact membership not substrings", async () => {
    const repo = new KnowledgeItemRepository(createFakeEntityManagerProvider());
    await repo.save(
      buildItem({ id: "item-1", collectionId: "collection-1", status: "draft", tagIds: ["tag-pricing"] }),
    );

    assert.equal(await repo.isTagInUse("tag-pricing"), true);
    assert.equal(await repo.isTagInUse("tag-price"), false);
    assert.equal(await repo.isTagInUse("tag-unused"), false);
  });
});
