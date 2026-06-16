import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CollectionRepository } from "./CollectionRepository.ts";
import { createFakeEntityManagerProvider } from "./testing/index.ts";
import { Collection } from "../../../../domain/aggregates/Collection.ts";
import { CollectionId } from "../../../../domain/identifiers/CollectionId.ts";

describe("CollectionRepository", () => {
  it("saves then finds a collection by id", async () => {
    const repo = new CollectionRepository(createFakeEntityManagerProvider());
    await repo.save(Collection.create(new CollectionId("collection-1"), "company-1", "Runbooks", null, "creator-1"));

    const found = await repo.findById(new CollectionId("collection-1"));

    assert.equal(found?.name, "Runbooks");
    assert.equal(await repo.findById(new CollectionId("missing")), null);
  });

  it("reports name existence", async () => {
    const repo = new CollectionRepository(createFakeEntityManagerProvider());
    await repo.save(Collection.create(new CollectionId("collection-1"), "company-1", "Runbooks", null, "creator-1"));

    assert.equal(await repo.existsByName("Runbooks"), true);
    assert.equal(await repo.existsByName("FAQs"), false);
  });

  it("lists every collection in scope", async () => {
    const repo = new CollectionRepository(createFakeEntityManagerProvider());
    await repo.save(Collection.create(new CollectionId("collection-1"), "company-1", "Runbooks", null, "creator-1"));
    await repo.save(Collection.create(new CollectionId("collection-2"), "company-1", "FAQs", null, "creator-1"));

    const all = await repo.listByCompany();

    assert.equal(all.length, 2);
  });
});
