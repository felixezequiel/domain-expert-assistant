import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Tag } from "./Tag.ts";
import { TagId } from "../identifiers/TagId.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

describe("Tag", () => {
  it("creates a tenant tag, slugifying the label, emitting TenantTagCreated", () => {
    const tag = Tag.createTenantTag(new TagId("t1"), "company-1", "  Refund Policy!  ");

    assert.equal(tag.scope, "tenant");
    assert.equal(tag.companyId, "company-1");
    assert.equal(tag.label, "Refund Policy!");
    assert.equal(tag.slug, "refund-policy");
    assert.equal(tag.isSystem(), false);
    assert.equal(tag.getDomainEvents()[0]!.eventName, "TenantTagCreated");
  });

  it("rejects a label that slugifies to nothing", () => {
    assert.throws(() => Tag.createTenantTag(new TagId("t1"), "company-1", "!!!"), /slug/);
  });

  it("throws a coded DomainError for an empty slug", () => {
    assert.throws(
      () => Tag.createTenantTag(new TagId("t1"), "company-1", "!!!"),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, "knowledge.tagLabelEmptySlug");
        assert.equal(error.kind, "validation");
        assert.equal(error.message, "Tag label must produce a non-empty slug");
        return true;
      },
    );
  });

  it("reconstitutes a seeded system tag (null company, immutable)", () => {
    const tag = Tag.reconstitute(new TagId("sys-glossary"), null, "glossario", "Glossário", "system");

    assert.equal(tag.isSystem(), true);
    assert.equal(tag.companyId, null);
    assert.equal(tag.getDomainEvents().length, 0);
  });

  it("removes a tenant tag (markForDeletion + TenantTagRemoved)", () => {
    const tag = Tag.createTenantTag(new TagId("t1"), "company-1", "Refunds");
    tag.drainDomainEvents();

    tag.requestRemoval();

    assert.equal(tag.isMarkedForDeletion(), true);
    assert.equal(tag.getDomainEvents()[0]!.eventName, "TenantTagRemoved");
  });

  it("refuses to remove a system tag", () => {
    const tag = Tag.reconstitute(new TagId("sys-rule"), null, "regra", "Regra", "system");

    assert.throws(() => tag.requestRemoval(), /system tag/);
  });

  it("throws a coded DomainError when removing a system tag", () => {
    const tag = Tag.reconstitute(new TagId("sys-rule"), null, "regra", "Regra", "system");

    assert.throws(
      () => tag.requestRemoval(),
      (error: unknown) => {
        assert.ok(error instanceof DomainError);
        assert.equal(error.code, "knowledge.cannotRemoveSystemTag");
        assert.equal(error.kind, "validation");
        assert.deepEqual(error.params, { slug: "regra" });
        assert.equal(error.message, "Cannot remove a system tag: regra");
        return true;
      },
    );
  });
});
