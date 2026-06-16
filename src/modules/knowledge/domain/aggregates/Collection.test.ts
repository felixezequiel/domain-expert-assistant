import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Collection } from "./Collection.ts";
import { CollectionId } from "../identifiers/CollectionId.ts";

function create(): Collection {
  return Collection.create(new CollectionId("col-1"), "company-1", "Policies", "Company policies", "user-1");
}

describe("Collection", () => {
  it("creates with a trimmed name + emits CollectionCreated", () => {
    const collection = Collection.create(new CollectionId("col-1"), "company-1", "  Policies  ", null, "user-1");

    assert.equal(collection.companyId, "company-1");
    assert.equal(collection.name, "Policies");
    assert.equal(collection.description, null);
    assert.equal(collection.getDomainEvents()[0]!.eventName, "CollectionCreated");
  });

  it("rejects an empty or over-long name", () => {
    assert.throws(() => Collection.create(new CollectionId("c"), "company-1", "  ", null, "u"), /name/);
    assert.throws(
      () => Collection.create(new CollectionId("c"), "company-1", "x".repeat(201), null, "u"),
      /name/,
    );
  });

  it("renames and emits CollectionRenamed", () => {
    const collection = create();
    collection.drainDomainEvents();

    collection.rename("New name");

    assert.equal(collection.name, "New name");
    assert.equal(collection.getDomainEvents()[0]!.eventName, "CollectionRenamed");
  });

  it("does not emit when renamed to the same name", () => {
    const collection = create();
    collection.drainDomainEvents();

    collection.rename("Policies");

    assert.equal(collection.getDomainEvents().length, 0);
  });

  it("reconstitutes without events", () => {
    const collection = Collection.reconstitute(
      new CollectionId("col-1"),
      "company-1",
      "Policies",
      null,
      "user-1",
    );
    assert.equal(collection.getDomainEvents().length, 0);
  });
});
