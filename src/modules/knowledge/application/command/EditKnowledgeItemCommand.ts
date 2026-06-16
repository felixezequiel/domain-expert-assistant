import { KnowledgeItemId } from "../../domain/identifiers/KnowledgeItemId.ts";
import { Title } from "../../domain/valueObjects/Title.ts";
import { KnowledgeBody } from "../../domain/valueObjects/KnowledgeBody.ts";
import { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";

export class EditKnowledgeItemCommand {
  public readonly itemId: KnowledgeItemId;
  public readonly title: Title;
  public readonly body: KnowledgeBody;
  public readonly sensitivity: SensitivityLevel;

  private constructor(itemId: KnowledgeItemId, title: Title, body: KnowledgeBody, sensitivity: SensitivityLevel) {
    this.itemId = itemId;
    this.title = title;
    this.body = body;
    this.sensitivity = sensitivity;
  }

  public static of(itemId: string, title: string, body: string, sensitivity: string): EditKnowledgeItemCommand {
    return new EditKnowledgeItemCommand(
      new KnowledgeItemId(itemId),
      new Title(title),
      new KnowledgeBody(body),
      SensitivityLevel.of(sensitivity),
    );
  }
}
