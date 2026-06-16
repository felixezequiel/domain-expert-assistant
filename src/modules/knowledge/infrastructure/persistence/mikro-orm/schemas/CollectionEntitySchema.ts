import { EntitySchema } from "@mikro-orm/core";
import { CollectionEntity } from "../entities/CollectionEntity.ts";
import {
  COMPANY_TENANT_FILTER_NAME,
  companyTenantFilterDefinition,
} from "../../../../../../shared/infrastructure/persistence/filters/CompanyFilter.ts";

export const CollectionEntitySchema = new EntitySchema<CollectionEntity>({
  class: CollectionEntity,
  tableName: "collections",
  properties: {
    id: { type: "string", primary: true },
    companyId: { type: "string", fieldName: "company_id" },
    name: { type: "string" },
    description: { type: "text", nullable: true },
    createdBy: { type: "string", fieldName: "created_by" },
  },
  filters: { [COMPANY_TENANT_FILTER_NAME]: companyTenantFilterDefinition },
});
