import { KnowledgeItemId } from "../../domain/identifiers/KnowledgeItemId.ts";
import { CollectionId } from "../../domain/identifiers/CollectionId.ts";
import { TagId } from "../../domain/identifiers/TagId.ts";
import { Title } from "../../domain/valueObjects/Title.ts";
import { KnowledgeBody } from "../../domain/valueObjects/KnowledgeBody.ts";
import { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";

export class CreateKnowledgeItemCommand {
  public readonly itemId: KnowledgeItemId;
  public readonly collectionId: CollectionId;
  public readonly title: Title;
  public readonly body: KnowledgeBody;
  public readonly tagIds: ReadonlyArray<TagId>;
  public readonly sensitivity: SensitivityLevel;

  private constructor(
    itemId: KnowledgeItemId,
    collectionId: CollectionId,
    title: Title,
    body: KnowledgeBody,
    tagIds: ReadonlyArray<TagId>,
    sensitivity: SensitivityLevel,
  ) {
    this.itemId = itemId;
    this.collectionId = collectionId;
    this.title = title;
    this.body = body;
    this.tagIds = tagIds;
    this.sensitivity = sensitivity;
  }

  public static of(
    itemId: string,
    collectionId: string,
    title: string,
    body: string,
    tagIds: ReadonlyArray<string>,
    sensitivity: string,
  ): CreateKnowledgeItemCommand {
    const tags: Array<TagId> = [];
    for (const tagId of tagIds) {
      tags.push(new TagId(tagId));
    }
    return new CreateKnowledgeItemCommand(
      new KnowledgeItemId(itemId),
      new CollectionId(collectionId),
      new Title(title),
      new KnowledgeBody(body),
      tags,
      SensitivityLevel.of(sensitivity),
    );
  }
}
