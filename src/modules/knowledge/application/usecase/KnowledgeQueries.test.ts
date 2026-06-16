import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GetKnowledgeItemUseCase,
  ListKnowledgeItemsUseCase,
  GetVersionHistoryUseCase,
  ListCollectionsUseCase,
  ListTagsUseCase,
} from "./KnowledgeQueries.ts";
import {
  FakeKnowledgeItemRepository,
  FakeCollectionRepository,
  FakeTagRepository,
  FakeKnowledgeVersionRepository,
} from "../testDoubles/index.ts";
import { KnowledgeItem } from "../../domain/aggregates/KnowledgeItem.ts";
import { KnowledgeItemId } from "../../domain/identifiers/KnowledgeItemId.ts";
import { Collection } from "../../domain/aggregates/Collection.ts";
import { CollectionId } from "../../domain/identifiers/CollectionId.ts";
import { Tag } from "../../domain/aggregates/Tag.ts";
import { TagId } from "../../domain/identifiers/TagId.ts";
import { Title } from "../../domain/valueObjects/Title.ts";
import { KnowledgeBody } from "../../domain/valueObjects/KnowledgeBody.ts";
import { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";
import { KnowledgeVersion } from "../../domain/entities/KnowledgeVersion.ts";

function item(id: string): KnowledgeItem {
  return KnowledgeItem.create(
    new KnowledgeItemId(id),
    "company-1",
    new CollectionId("c1"),
    new Title("T " + id),
    new KnowledgeBody("B"),
    [new TagId("t1")],
    SensitivityLevel.of("internal"),
    "author-1",
  );
}

describe("Knowledge queries", () => {
  it("gets an item as a view or null", async () => {
    const repo = new FakeKnowledgeItemRepository();
    await repo.save(item("i1"));
    const useCase = new GetKnowledgeItemUseCase(repo);

    assert.equal((await useCase.execute("i1"))?.title, "T i1");
    assert.equal(await useCase.execute("missing"), null);
  });

  it("lists items filtered by status", async () => {
    const repo = new FakeKnowledgeItemRepository();
    await repo.save(item("i1"));
    const published = item("i2");
    published.submitForReview();
    published.approve("reviewer-1", false);
    await repo.save(published);
    const useCase = new ListKnowledgeItemsUseCase(repo);

    const drafts = await useCase.execute({ collectionId: null, status: "draft" });
    assert.deepEqual(drafts.map((v) => v.id), ["i1"]);
  });

  it("returns version history", async () => {
    const repo = new FakeKnowledgeVersionRepository();
    await repo.append(
      new KnowledgeVersion({ itemId: "i1", versionNumber: 1, title: "T", body: "B", tagIds: [], sensitivity: "public", createdBy: "a", createdAt: new Date("2026-06-16T00:00:00.000Z") }),
    );
    const useCase = new GetVersionHistoryUseCase(repo);

    const history = await useCase.execute("i1");
    assert.equal(history.length, 1);
    assert.equal(history[0]!.createdAt, "2026-06-16T00:00:00.000Z");
  });

  it("lists collections and tags as views", async () => {
    const collectionRepository = new FakeCollectionRepository();
    await collectionRepository.save(Collection.create(new CollectionId("c1"), "company-1", "Policies", null, "admin"));
    const tagRepository = new FakeTagRepository();
    await tagRepository.save(Tag.createTenantTag(new TagId("t1"), "company-1", "Refunds"));

    assert.equal((await new ListCollectionsUseCase(collectionRepository).execute())[0]!.name, "Policies");
    assert.equal((await new ListTagsUseCase(tagRepository).execute())[0]!.slug, "refunds");
  });
});
