import { PlainObject } from "@mikro-orm/core";

export class KnowledgeVersionEntity extends PlainObject {
  // Primary key is `${itemId}:${versionNumber}` — versions are append-only and unique per item.
  public id!: string;
  public itemId!: string;
  public companyId!: string;
  public versionNumber!: number;
  public title!: string;
  public body!: string;
  public tagIds!: string;
  public sensitivity!: string;
  public createdBy!: string;
  public createdAt!: string;
}
