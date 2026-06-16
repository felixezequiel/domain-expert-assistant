import { EntitySchema } from "@mikro-orm/core";
import { IngestionJobEntity } from "../entities/IngestionJobEntity.ts";
import {
  COMPANY_TENANT_FILTER_NAME,
  companyTenantFilterDefinition,
} from "../../../../../../shared/infrastructure/persistence/filters/CompanyFilter.ts";

export const IngestionJobEntitySchema = new EntitySchema<IngestionJobEntity>({
  class: IngestionJobEntity,
  tableName: "ingestion_jobs",
  properties: {
    id: { type: "string", primary: true },
    companyId: { type: "string", fieldName: "company_id" },
    collectionId: { type: "string", fieldName: "collection_id" },
    filename: { type: "string" },
    mimeType: { type: "string", fieldName: "mime_type" },
    storageRef: { type: "string", fieldName: "storage_ref" },
    status: { type: "string" },
    createdItemId: { type: "string", fieldName: "created_item_id", nullable: true },
    failureReason: { type: "text", fieldName: "failure_reason", nullable: true },
    createdBy: { type: "string", fieldName: "created_by" },
    createdAt: { type: "string", fieldName: "created_at" },
  },
  filters: { [COMPANY_TENANT_FILTER_NAME]: companyTenantFilterDefinition },
});
