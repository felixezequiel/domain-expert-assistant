import { EntitySchema } from "@mikro-orm/core";
import { UserEntity } from "../entities/UserEntity.ts";
import {
  COMPANY_TENANT_FILTER_NAME,
  companyTenantFilterDefinition,
} from "../../../../../../shared/infrastructure/persistence/filters/CompanyFilter.ts";

export const UserEntitySchema = new EntitySchema<UserEntity>({
  class: UserEntity,
  tableName: "users",
  properties: {
    id: { type: "string", primary: true },
    companyId: { type: "string", fieldName: "company_id" },
    email: { type: "string", unique: true },
    displayName: { type: "string", fieldName: "display_name" },
    passwordHash: { type: "string", fieldName: "password_hash", nullable: true },
    roles: { type: "string" },
    status: { type: "string" },
    invitationTokenHash: { type: "string", fieldName: "invitation_token_hash", nullable: true },
  },
  filters: {
    [COMPANY_TENANT_FILTER_NAME]: companyTenantFilterDefinition,
  },
});
