import { PlainObject } from "@mikro-orm/core";

export class SystemEventEntity extends PlainObject {
  public id!: string;
  public eventName!: string;
  public aggregateId!: string;
  public occurredAt!: string;
  public payload!: string;
  public causationId!: string | null;
  // Envelope (ADR-008/009): who originated the event and in which tenant. companyId is
  // null for privileged operator/system actions — invisible to the tenant auditor by
  // construction (the company filter never matches null).
  public companyId!: string | null;
  public actorId!: string | null;
  public actorType!: string | null;
}
