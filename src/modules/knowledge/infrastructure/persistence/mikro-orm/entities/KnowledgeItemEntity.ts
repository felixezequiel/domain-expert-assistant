import { PlainObject } from "@mikro-orm/core";

export class KnowledgeItemEntity extends PlainObject {
  public id!: string;
  public companyId!: string;
  public collectionId!: string;
  public title!: string;
  public body!: string;
  // Tag ids as a comma-joined list.
  public tagIds!: string;
  public sensitivity!: string;
  public status!: string;
  public currentVersionNumber!: number;
  public publishedVersionNumber!: number | null;
  public authorId!: string;
  public lastEditorId!: string;
  public lastRejectionReason!: string | null;
  public createdAt!: string;
}
