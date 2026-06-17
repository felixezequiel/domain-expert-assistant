import { EntitySchema } from "@mikro-orm/core";
import { KnowledgeItemEntity } from "../entities/KnowledgeItemEntity.ts";
import {
  COMPANY_TENANT_FILTER_NAME,
  companyTenantFilterDefinition,
} from "../../../../../../shared/infrastructure/persistence/filters/CompanyFilter.ts";

export const KnowledgeItemEntitySchema = new EntitySchema<KnowledgeItemEntity>({
  class: KnowledgeItemEntity,
  tableName: "knowledge_items",
  properties: {
    id: { type: "string", primary: true },
    companyId: { type: "string", fieldName: "company_id" },
    collectionId: { type: "string", fieldName: "collection_id" },
    title: { type: "string" },
    body: { type: "text" },
    tagIds: { type: "text", fieldName: "tag_ids" },
    sensitivity: { type: "string" },
    status: { type: "string" },
    currentVersionNumber: { type: "number", fieldName: "current_version_number" },
    publishedVersionNumber: { type: "number", fieldName: "published_version_number", nullable: true },
    authorId: { type: "string", fieldName: "author_id" },
    lastEditorId: { type: "string", fieldName: "last_editor_id" },
    lastRejectionReason: { type: "text", fieldName: "last_rejection_reason", nullable: true },
    createdAt: { type: "string", fieldName: "created_at" },
  },
  filters: { [COMPANY_TENANT_FILTER_NAME]: companyTenantFilterDefinition },
});
