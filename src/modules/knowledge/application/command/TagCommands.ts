import { TagId } from "../../domain/identifiers/TagId.ts";

export class CreateTenantTagCommand {
  public readonly tagId: TagId;
  public readonly label: string;

  private constructor(tagId: TagId, label: string) {
    this.tagId = tagId;
    this.label = label;
  }

  public static of(tagId: string, label: string): CreateTenantTagCommand {
    if (label.trim().length === 0) {
      throw new Error("Tag label is required");
    }
    return new CreateTenantTagCommand(new TagId(tagId), label);
  }
}

export class RemoveTenantTagCommand {
  public readonly tagId: TagId;

  private constructor(tagId: TagId) {
    this.tagId = tagId;
  }

  public static of(tagId: string): RemoveTenantTagCommand {
    return new RemoveTenantTagCommand(new TagId(tagId));
  }
}
