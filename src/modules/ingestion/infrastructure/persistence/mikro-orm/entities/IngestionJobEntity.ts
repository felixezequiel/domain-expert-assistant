import { PlainObject } from "@mikro-orm/core";

export class IngestionJobEntity extends PlainObject {
  public id!: string;
  public companyId!: string;
  public collectionId!: string;
  public filename!: string;
  public mimeType!: string;
  public storageRef!: string;
  public status!: string;
  public createdItemId!: string | null;
  public failureReason!: string | null;
  public createdBy!: string;
  public createdAt!: string;
}
