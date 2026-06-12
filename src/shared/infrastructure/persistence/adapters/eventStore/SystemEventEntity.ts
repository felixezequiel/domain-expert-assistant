import { PlainObject } from "@mikro-orm/core";

export class SystemEventEntity extends PlainObject {
  public id!: string;
  public eventName!: string;
  public aggregateId!: string;
  public occurredAt!: string;
  public payload!: string;
  public causationId!: string | null;
}
