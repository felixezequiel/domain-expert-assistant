import { EntitySchema } from "@mikro-orm/core";
import { TagEntity } from "../entities/TagEntity.ts";
import {
  COMPANY_OR_SYSTEM_FILTER_NAME,
  companyOrSystemFilterDefinition,
} from "../../../../../../shared/infrastructure/persistence/filters/CompanyOrSystemFilter.ts";

// Shared-reference table (ADR-014): filtered by "this tenant ∪ system", not the strict
// company filter — system tags (company_id null, scope 'system') are visible to all tenants.
export const TagEntitySchema = new EntitySchema<TagEntity>({
  class: TagEntity,
  tableName: "tags",
  properties: {
    id: { type: "string", primary: true },
    companyId: { type: "string", fieldName: "company_id", nullable: true },
    slug: { type: "string" },
    label: { type: "string" },
    scope: { type: "string" },
  },
  filters: { [COMPANY_OR_SYSTEM_FILTER_NAME]: companyOrSystemFilterDefinition },
});
