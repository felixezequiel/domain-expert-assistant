import { EntitySchema } from "@mikro-orm/core";
import { OrganizationEntity } from "../entities/OrganizationEntity.ts";

// The organization IS the tenant, so this table is deliberately NOT company-filtered
// (PRD-1 §9). Everything beneath it is.
export const OrganizationEntitySchema = new EntitySchema<OrganizationEntity>({
  class: OrganizationEntity,
  tableName: "organizations",
  properties: {
    id: { type: "string", primary: true },
    name: { type: "string", unique: true },
    status: { type: "string" },
    requireSeparateReviewer: { type: "boolean", fieldName: "require_separate_reviewer" },
    createdAt: { type: "string", fieldName: "created_at" },
  },
});
