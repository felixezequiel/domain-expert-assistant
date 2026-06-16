import { KnowledgeItemId } from "../../domain/identifiers/KnowledgeItemId.ts";
import { CollectionId } from "../../domain/identifiers/CollectionId.ts";
import { TagId } from "../../domain/identifiers/TagId.ts";

export class RollbackToVersionCommand {
  public readonly itemId: KnowledgeItemId;
  public readonly versionNumber: number;

  private constructor(itemId: KnowledgeItemId, versionNumber: number) {
    this.itemId = itemId;
    this.versionNumber = versionNumber;
  }

  public static of(itemId: string, versionNumber: number): RollbackToVersionCommand {
    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      throw new Error("Version number must be a positive integer");
    }
    return new RollbackToVersionCommand(new KnowledgeItemId(itemId), versionNumber);
  }
}

export class RetagItemCommand {
  public readonly itemId: KnowledgeItemId;
  public readonly tagIds: ReadonlyArray<TagId>;

  private constructor(itemId: KnowledgeItemId, tagIds: ReadonlyArray<TagId>) {
    this.itemId = itemId;
    this.tagIds = tagIds;
  }

  public static of(itemId: string, tagIds: ReadonlyArray<string>): RetagItemCommand {
    const tags: Array<TagId> = [];
    for (const tagId of tagIds) {
      tags.push(new TagId(tagId));
    }
    return new RetagItemCommand(new KnowledgeItemId(itemId), tags);
  }
}

export class MoveItemToCollectionCommand {
  public readonly itemId: KnowledgeItemId;
  public readonly collectionId: CollectionId;

  private constructor(itemId: KnowledgeItemId, collectionId: CollectionId) {
    this.itemId = itemId;
    this.collectionId = collectionId;
  }

  public static of(itemId: string, collectionId: string): MoveItemToCollectionCommand {
    return new MoveItemToCollectionCommand(new KnowledgeItemId(itemId), new CollectionId(collectionId));
  }
}
