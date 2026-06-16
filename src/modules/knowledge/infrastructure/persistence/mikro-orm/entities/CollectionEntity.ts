import { PlainObject } from "@mikro-orm/core";

export class CollectionEntity extends PlainObject {
  public id!: string;
  public companyId!: string;
  public name!: string;
  public description!: string | null;
  public createdBy!: string;
}
