import { PlainObject } from "@mikro-orm/core";

export class ConsumerCredentialEntity extends PlainObject {
  public id!: string;
  public companyId!: string;
  public name!: string;
  public keyPrefix!: string;
  public secretHash!: string;
  // Scope: collection ids as a comma-joined list + the sensitivity ceiling name.
  public collectionIds!: string;
  public sensitivityCeiling!: string;
  public status!: string;
  public createdBy!: string;
  public createdAt!: string;
  public lastUsedAt!: string | null;
}
