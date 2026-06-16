import { EntitySchema } from "@mikro-orm/core";
import { SystemEventEntity } from "./SystemEventEntity.ts";
import {
  COMPANY_TENANT_FILTER_NAME,
  companyTenantFilterDefinition,
} from "../../filters/CompanyFilter.ts";

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
    companyId: { type: "string", fieldName: "company_id", nullable: true },
    actorId: { type: "string", fieldName: "actor_id", nullable: true },
    actorType: { type: "string", fieldName: "actor_type", nullable: true },
  },
  // Tenant filter so the auditor read model only ever sees its own tenant's events
  // (ADR-009). Privileged events (company_id null) never match the filter, so they are
  // captured but invisible to tenant auditors by construction.
  filters: {
    [COMPANY_TENANT_FILTER_NAME]: companyTenantFilterDefinition,
  },
});
