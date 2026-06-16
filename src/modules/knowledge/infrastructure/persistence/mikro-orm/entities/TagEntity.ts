import { PlainObject } from "@mikro-orm/core";

export class TagEntity extends PlainObject {
  public id!: string;
  // Null for system tags (shared reference data, ADR-014).
  public companyId!: string | null;
  public slug!: string;
  public label!: string;
  public scope!: string;
}
