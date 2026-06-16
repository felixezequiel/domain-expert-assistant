import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  RollbackToVersionUseCase,
  RetagItemUseCase,
  MoveItemToCollectionUseCase,
} from "./ItemContentUseCases.ts";
import {
  RollbackToVersionCommand,
  RetagItemCommand,
  MoveItemToCollectionCommand,
} from "../command/ContentCommands.ts";
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
import { runWithActor } from "../../../../shared/application/context/ActorContext.ts";

const CURATOR = { companyId: "company-1", actorId: "curator-1", actorType: "user" as const, roles: ["curator" as const] };

function item(): KnowledgeItem {
  return KnowledgeItem.create(
    new KnowledgeItemId("i1"),
    "company-1",
    new CollectionId("c1"),
    new Title("Bad"),
    new KnowledgeBody("Bad body"),
    [new TagId("t1")],
    SensitivityLevel.of("internal"),
    "author-1",
  );
}

describe("ItemContentUseCases", () => {
  it("rolls back to a stored version as a new draft", async () => {
    const itemRepository = new FakeKnowledgeItemRepository();
    await itemRepository.save(item());
    const versionRepository = new FakeKnowledgeVersionRepository();
    await versionRepository.append(
      new KnowledgeVersion({
        itemId: "i1",
        versionNumber: 1,
        title: "Good title",
        body: "Good body",
        tagIds: ["t1"],
        sensitivity: "public",
        createdBy: "author-1",
        createdAt: new Date("2026-06-16T00:00:00.000Z"),
      }),
    );
    const useCase = new RollbackToVersionUseCase(itemRepository, versionRepository, () => new Date("2026-06-16T01:00:00.000Z"));

    const result = await runWithActor(CURATOR, () => useCase.execute(RollbackToVersionCommand.of("i1", 1)));

    assert.equal(result.title.value, "Good title");
    assert.equal(result.status, "draft");
    assert.equal(result.currentVersionNumber, 2);
  });

  it("retags after validating the tags exist", async () => {
    const itemRepository = new FakeKnowledgeItemRepository();
    await itemRepository.save(item());
    const tagRepository = new FakeTagRepository();
    await tagRepository.save(Tag.createTenantTag(new TagId("t2"), "company-1", "Refunds"));
    const useCase = new RetagItemUseCase(itemRepository, tagRepository, new FakeKnowledgeVersionRepository(), () => new Date());

    const result = await runWithActor(CURATOR, () => useCase.execute(RetagItemCommand.of("i1", ["t2"])));
    assert.deepEqual(result.tagIds.map((t) => t.value), ["t2"]);

    await assert.rejects(
      () => runWithActor(CURATOR, () => useCase.execute(RetagItemCommand.of("i1", ["ghost"]))),
      /Unknown tag/,
    );
  });

  it("moves to an existing collection and rejects an unknown one", async () => {
    const itemRepository = new FakeKnowledgeItemRepository();
    await itemRepository.save(item());
    const collectionRepository = new FakeCollectionRepository();
    await collectionRepository.save(Collection.create(new CollectionId("c2"), "company-1", "Other", null, "admin"));
    const useCase = new MoveItemToCollectionUseCase(itemRepository, collectionRepository);

    const result = await useCase.execute(MoveItemToCollectionCommand.of("i1", "c2"));
    assert.equal(result.collectionId.value, "c2");

    await assert.rejects(() => useCase.execute(MoveItemToCollectionCommand.of("i1", "missing")), /Collection not found/);
  });
});
