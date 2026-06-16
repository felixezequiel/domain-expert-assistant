import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TagMapper } from "./TagMapper.ts";
import { Tag } from "../../../../domain/aggregates/Tag.ts";
import { TagId } from "../../../../domain/identifiers/TagId.ts";

describe("TagMapper", () => {
  it("round-trips a tenant tag (companyId set, scope tenant)", () => {
    const original = Tag.reconstitute(new TagId("tag-1"), "company-1", "pricing", "Pricing", "tenant");

    const entity = TagMapper.toOrmEntity(original);
    assert.equal(entity.companyId, "company-1");
    assert.equal(entity.scope, "tenant");

    const domain = TagMapper.toDomain(entity);
    assert.equal(domain.id.value, "tag-1");
    assert.equal(domain.companyId, "company-1");
    assert.equal(domain.slug, "pricing");
    assert.equal(domain.label, "Pricing");
    assert.equal(domain.scope, "tenant");
  });

  it("round-trips a system tag (companyId null, scope system)", () => {
    const original = Tag.reconstitute(new TagId("system-tag-faq"), null, "faq", "Faq", "system");

    const entity = TagMapper.toOrmEntity(original);
    assert.equal(entity.companyId, null);

    const domain = TagMapper.toDomain(entity);
    assert.equal(domain.companyId, null);
    assert.equal(domain.scope, "system");
    assert.equal(domain.isSystem(), true);
  });
});
