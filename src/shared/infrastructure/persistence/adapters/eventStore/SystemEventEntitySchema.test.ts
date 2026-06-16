import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EntitySchema } from "@mikro-orm/core";
import { SystemEventEntitySchema } from "./SystemEventEntitySchema.ts";
import { COMPANY_TENANT_FILTER_NAME } from "../../filters/CompanyFilter.ts";

describe("SystemEventEntitySchema", () => {
  it("is an EntitySchema mapped to the system_events table", () => {
    assert.ok(SystemEventEntitySchema instanceof EntitySchema);
    assert.equal(SystemEventEntitySchema.meta.collection, "system_events");
  });

  it("maps the actor envelope columns to their snake_case names", () => {
    const properties = SystemEventEntitySchema.meta.properties;

    assert.equal(properties.companyId.fieldName, "company_id");
    assert.equal(properties.actorId.fieldName, "actor_id");
    assert.equal(properties.actorType.fieldName, "actor_type");
  });

  it("declares the company tenant filter so the auditor read model is tenant-isolated", () => {
    assert.ok(SystemEventEntitySchema.meta.filters[COMPANY_TENANT_FILTER_NAME] !== undefined);
  });
});
