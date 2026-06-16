import { PlainObject } from "@mikro-orm/core";

export class OrganizationEntity extends PlainObject {
  public id!: string;
  public name!: string;
  public status!: string;
  public requireSeparateReviewer!: boolean;
  public createdAt!: string;
}
