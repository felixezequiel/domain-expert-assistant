import { EntitySchema } from "@mikro-orm/core";
import { ConsumerCredentialEntity } from "../entities/ConsumerCredentialEntity.ts";
import {
  COMPANY_TENANT_FILTER_NAME,
  companyTenantFilterDefinition,
} from "../../../../../../shared/infrastructure/persistence/filters/CompanyFilter.ts";

export const ConsumerCredentialEntitySchema = new EntitySchema<ConsumerCredentialEntity>({
  class: ConsumerCredentialEntity,
  tableName: "consumer_credentials",
  properties: {
    id: { type: "string", primary: true },
    companyId: { type: "string", fieldName: "company_id" },
    name: { type: "string" },
    keyPrefix: { type: "string", fieldName: "key_prefix" },
    secretHash: { type: "string", fieldName: "secret_hash", index: true },
    collectionIds: { type: "string", fieldName: "collection_ids" },
    sensitivityCeiling: { type: "string", fieldName: "sensitivity_ceiling" },
    status: { type: "string" },
    createdBy: { type: "string", fieldName: "created_by" },
    createdAt: { type: "string", fieldName: "created_at" },
    lastUsedAt: { type: "string", fieldName: "last_used_at", nullable: true },
  },
  filters: {
    [COMPANY_TENANT_FILTER_NAME]: companyTenantFilterDefinition,
  },
});
