import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PlainObject } from "@mikro-orm/core";
import { SystemEventEntity } from "./SystemEventEntity.ts";

describe("SystemEventEntity", () => {
  it("extends PlainObject so mappers read raw primitives, not ORM proxies", () => {
    assert.ok(new SystemEventEntity() instanceof PlainObject);
  });

  it("carries the full event envelope including actor/tenant fields", () => {
    const entity = new SystemEventEntity();
    entity.id = "e1";
    entity.eventName = "Sample";
    entity.aggregateId = "agg-1";
    entity.occurredAt = "2026-06-16T00:00:00.000Z";
    entity.payload = "{}";
    entity.causationId = null;
    entity.companyId = "company-1";
    entity.actorId = "user-1";
    entity.actorType = "user";

    assert.equal(entity.companyId, "company-1");
    assert.equal(entity.actorId, "user-1");
    assert.equal(entity.actorType, "user");
  });

  it("allows null envelope fields for privileged operator/system events", () => {
    const entity = new SystemEventEntity();
    entity.companyId = null;
    entity.actorId = null;
    entity.actorType = null;

    assert.equal(entity.companyId, null);
    assert.equal(entity.actorId, null);
    assert.equal(entity.actorType, null);
  });
});
