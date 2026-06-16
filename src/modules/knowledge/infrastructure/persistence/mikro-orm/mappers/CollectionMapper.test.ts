import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CollectionMapper } from "./CollectionMapper.ts";
import { Collection } from "../../../../domain/aggregates/Collection.ts";
import { CollectionId } from "../../../../domain/identifiers/CollectionId.ts";

describe("CollectionMapper", () => {
  it("round-trips a collection with a description", () => {
    const original = Collection.reconstitute(
      new CollectionId("collection-1"),
      "company-1",
      "Runbooks",
      "Operational runbooks",
      "creator-1",
    );

    const domain = CollectionMapper.toDomain(CollectionMapper.toOrmEntity(original));

    assert.equal(domain.id.value, "collection-1");
    assert.equal(domain.companyId, "company-1");
    assert.equal(domain.name, "Runbooks");
    assert.equal(domain.description, "Operational runbooks");
    assert.equal(domain.createdBy, "creator-1");
  });

  it("round-trips a collection with a null description", () => {
    const original = Collection.reconstitute(
      new CollectionId("collection-2"),
      "company-1",
      "FAQs",
      null,
      "creator-1",
    );

    const domain = CollectionMapper.toDomain(CollectionMapper.toOrmEntity(original));

    assert.equal(domain.description, null);
  });
});
