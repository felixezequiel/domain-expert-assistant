import { EntitySchema } from "@mikro-orm/core";
import { KnowledgeVersionEntity } from "../entities/KnowledgeVersionEntity.ts";
import {
  COMPANY_TENANT_FILTER_NAME,
  companyTenantFilterDefinition,
} from "../../../../../../shared/infrastructure/persistence/filters/CompanyFilter.ts";

export const KnowledgeVersionEntitySchema = new EntitySchema<KnowledgeVersionEntity>({
  class: KnowledgeVersionEntity,
  tableName: "knowledge_versions",
  properties: {
    id: { type: "string", primary: true },
    itemId: { type: "string", fieldName: "item_id" },
    companyId: { type: "string", fieldName: "company_id" },
    versionNumber: { type: "number", fieldName: "version_number" },
    title: { type: "string" },
    body: { type: "text" },
    tagIds: { type: "text", fieldName: "tag_ids" },
    sensitivity: { type: "string" },
    createdBy: { type: "string", fieldName: "created_by" },
    createdAt: { type: "string", fieldName: "created_at" },
  },
  filters: { [COMPANY_TENANT_FILTER_NAME]: companyTenantFilterDefinition },
});
