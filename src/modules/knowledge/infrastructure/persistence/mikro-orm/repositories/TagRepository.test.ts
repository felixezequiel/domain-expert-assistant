import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TagRepository } from "./TagRepository.ts";
import { createFakeEntityManagerProvider } from "./testing/index.ts";
import { Tag } from "../../../../domain/aggregates/Tag.ts";
import { TagId } from "../../../../domain/identifiers/TagId.ts";

describe("TagRepository", () => {
  it("saves then finds a tag by id", async () => {
    const repo = new TagRepository(createFakeEntityManagerProvider());
    await repo.save(Tag.createTenantTag(new TagId("tag-1"), "company-1", "Pricing"));

    const found = await repo.findById(new TagId("tag-1"));

    assert.equal(found?.slug, "pricing");
    assert.equal(await repo.findById(new TagId("missing")), null);
  });

  it("reports slug existence", async () => {
    const repo = new TagRepository(createFakeEntityManagerProvider());
    await repo.save(Tag.createTenantTag(new TagId("tag-1"), "company-1", "Pricing"));

    assert.equal(await repo.existsBySlug("pricing"), true);
    assert.equal(await repo.existsBySlug("billing"), false);
  });

  it("lists every tag in scope", async () => {
    const repo = new TagRepository(createFakeEntityManagerProvider());
    await repo.save(Tag.createTenantTag(new TagId("tag-1"), "company-1", "Pricing"));
    await repo.save(Tag.reconstitute(new TagId("system-tag-faq"), null, "faq", "Faq", "system"));

    const all = await repo.listForTenant();

    assert.equal(all.length, 2);
  });

  it("returns only the requested tag ids that exist", async () => {
    const repo = new TagRepository(createFakeEntityManagerProvider());
    await repo.save(Tag.createTenantTag(new TagId("tag-1"), "company-1", "Pricing"));
    await repo.save(Tag.reconstitute(new TagId("system-tag-faq"), null, "faq", "Faq", "system"));

    const existing = await repo.existingTagIds(["tag-1", "system-tag-faq", "tag-missing"]);

    assert.deepEqual([...existing].sort(), ["system-tag-faq", "tag-1"]);
  });

  it("returns an empty list when no tag ids are requested", async () => {
    const repo = new TagRepository(createFakeEntityManagerProvider());

    assert.deepEqual(await repo.existingTagIds([]), []);
  });
});
