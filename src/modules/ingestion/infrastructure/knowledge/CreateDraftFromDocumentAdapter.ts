import { randomUUID } from "node:crypto";
import type {
  KnowledgeDraftCreationPort,
  CreateDraftFromDocumentInput,
} from "../../application/types.ts";
import type { CreateKnowledgeItemUseCase } from "../../../knowledge/application/usecase/CreateKnowledgeItemUseCase.ts";
import { CreateKnowledgeItemCommand } from "../../../knowledge/application/command/CreateKnowledgeItemCommand.ts";

const DEFAULT_SENSITIVITY = "internal";

/**
 * Bridges Ingestion's `KnowledgeDraftCreationPort` onto Knowledge's CreateKnowledgeItem use
 * case (ADR-015: a document becomes one draft item). Called from within the worker's
 * ApplicationService transaction, so the created item + its v1 snapshot commit atomically
 * with the ingestion job. Ingested docs default to `internal` sensitivity and no tags;
 * the curator refines them afterwards.
 */
export class CreateDraftFromDocumentAdapter implements KnowledgeDraftCreationPort {
  private readonly createKnowledgeItem: CreateKnowledgeItemUseCase;

  constructor(createKnowledgeItem: CreateKnowledgeItemUseCase) {
    this.createKnowledgeItem = createKnowledgeItem;
  }

  public async createDraftFromDocument(input: CreateDraftFromDocumentInput): Promise<string> {
    const command = CreateKnowledgeItemCommand.of(
      randomUUID(),
      input.collectionId,
      input.title,
      input.body,
      [],
      DEFAULT_SENSITIVITY,
    );
    const item = await this.createKnowledgeItem.execute(command);
    return item.id.value;
  }
}
