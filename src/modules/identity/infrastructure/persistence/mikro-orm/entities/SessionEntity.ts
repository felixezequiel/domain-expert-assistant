import { PlainObject } from "@mikro-orm/core";

export class SessionEntity extends PlainObject {
  public id!: string;
  public tokenHash!: string;
  public userId!: string;
  public companyId!: string;
  public createdAt!: string;
  public expiresAt!: string;
  public revoked!: boolean;
}
