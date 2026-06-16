import { PlainObject } from "@mikro-orm/core";

export class UserEntity extends PlainObject {
  public id!: string;
  public companyId!: string;
  public email!: string;
  public displayName!: string;
  public passwordHash!: string | null;
  // Roles stored as a comma-joined list (e.g. "admin,curator").
  public roles!: string;
  public status!: string;
  public invitationTokenHash!: string | null;
}
