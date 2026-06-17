import { KnowledgeItemId } from "../../domain/identifiers/KnowledgeItemId.ts";
import { TagId } from "../../domain/identifiers/TagId.ts";
import { Title } from "../../domain/valueObjects/Title.ts";
import { KnowledgeBody } from "../../domain/valueObjects/KnowledgeBody.ts";
import { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";

export class EditKnowledgeItemCommand {
  public readonly itemId: KnowledgeItemId;
  public readonly title: Title;
  public readonly body: KnowledgeBody;
  public readonly sensitivity: SensitivityLevel;
  public readonly tagIds: ReadonlyArray<TagId>;

  private constructor(
    itemId: KnowledgeItemId,
    title: Title,
    body: KnowledgeBody,
    sensitivity: SensitivityLevel,
    tagIds: ReadonlyArray<TagId>,
  ) {
    this.itemId = itemId;
    this.title = title;
    this.body = body;
    this.sensitivity = sensitivity;
    this.tagIds = tagIds;
  }

  // Content + tags are one revision: the edit applies both as a single new version, so a Save
  // that also changes tags no longer spawns a second version (finding B1).
  public static of(
    itemId: string,
    title: string,
    body: string,
    sensitivity: string,
    tagIds: ReadonlyArray<string>,
  ): EditKnowledgeItemCommand {
    return new EditKnowledgeItemCommand(
      new KnowledgeItemId(itemId),
      new Title(title),
      new KnowledgeBody(body),
      SensitivityLevel.of(sensitivity),
      tagIds.map((tagId) => new TagId(tagId)),
    );
  }
}
