import { EntitySchema } from "@mikro-orm/core";
import { SystemEventEntity } from "./SystemEventEntity.ts";

export const SystemEventEntitySchema = new EntitySchema<SystemEventEntity>({
  class: SystemEventEntity,
  tableName: "system_events",
  properties: {
    id: { type: "string", primary: true },
    eventName: { type: "string", fieldName: "event_name" },
    aggregateId: { type: "string", fieldName: "aggregate_id" },
    occurredAt: { type: "string", fieldName: "occurred_at" },
    payload: { type: "string" },
    causationId: { type: "string", fieldName: "causation_id", nullable: true },
  },
});
