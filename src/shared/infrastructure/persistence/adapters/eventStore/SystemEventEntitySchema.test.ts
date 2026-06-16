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
    // Pre-init the schema definition exposes `fieldName` (singular); the typed view only
    // declares the post-init `fieldNames` array, so read the raw definition via a cast.
    const properties = SystemEventEntitySchema.meta.properties as unknown as {
      companyId: { fieldName?: string };
      actorId: { fieldName?: string };
      actorType: { fieldName?: string };
    };

    assert.equal(properties.companyId.fieldName, "company_id");
    assert.equal(properties.actorId.fieldName, "actor_id");
    assert.equal(properties.actorType.fieldName, "actor_type");
  });

  it("declares the company tenant filter so the auditor read model is tenant-isolated", () => {
    assert.ok(SystemEventEntitySchema.meta.filters[COMPANY_TENANT_FILTER_NAME] !== undefined);
  });
});
