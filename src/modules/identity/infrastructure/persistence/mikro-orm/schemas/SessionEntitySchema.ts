import { EntitySchema } from "@mikro-orm/core";
import { SessionEntity } from "../entities/SessionEntity.ts";
import {
  COMPANY_TENANT_FILTER_NAME,
  companyTenantFilterDefinition,
} from "../../../../../../shared/infrastructure/persistence/filters/CompanyFilter.ts";

export const SessionEntitySchema = new EntitySchema<SessionEntity>({
  class: SessionEntity,
  tableName: "sessions",
  properties: {
    id: { type: "string", primary: true },
    tokenHash: { type: "string", fieldName: "token_hash", index: true },
    userId: { type: "string", fieldName: "user_id" },
    companyId: { type: "string", fieldName: "company_id" },
    createdAt: { type: "string", fieldName: "created_at" },
    expiresAt: { type: "string", fieldName: "expires_at" },
    revoked: { type: "boolean" },
  },
  filters: {
    [COMPANY_TENANT_FILTER_NAME]: companyTenantFilterDefinition,
  },
});
