import { KnowledgeItemId } from "../../domain/identifiers/KnowledgeItemId.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

/** Thin id-only (and reason) lifecycle commands, grouped since they share construction. */
abstract class ItemCommand {
  public readonly itemId: KnowledgeItemId;
  protected constructor(itemId: KnowledgeItemId) {
    this.itemId = itemId;
  }
}

export class SubmitForReviewCommand extends ItemCommand {
  public static of(itemId: string): SubmitForReviewCommand {
    return new SubmitForReviewCommand(new KnowledgeItemId(itemId));
  }
}

export class ApproveItemCommand extends ItemCommand {
  public static of(itemId: string): ApproveItemCommand {
    return new ApproveItemCommand(new KnowledgeItemId(itemId));
  }
}

export class DeprecateItemCommand extends ItemCommand {
  public static of(itemId: string): DeprecateItemCommand {
    return new DeprecateItemCommand(new KnowledgeItemId(itemId));
  }
}

export class ArchiveItemCommand extends ItemCommand {
  public static of(itemId: string): ArchiveItemCommand {
    return new ArchiveItemCommand(new KnowledgeItemId(itemId));
  }
}

export class RejectItemCommand {
  public readonly itemId: KnowledgeItemId;
  public readonly reason: string;

  private constructor(itemId: KnowledgeItemId, reason: string) {
    this.itemId = itemId;
    this.reason = reason;
  }

  public static of(itemId: string, reason: string): RejectItemCommand {
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      throw new DomainError(
        "knowledge.rejectionReasonRequired",
        "validation",
        undefined,
        "A rejection reason is required",
      );
    }
    return new RejectItemCommand(new KnowledgeItemId(itemId), trimmed);
  }
}
