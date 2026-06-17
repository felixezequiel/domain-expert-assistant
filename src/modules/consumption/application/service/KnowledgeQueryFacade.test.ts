import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { KnowledgeQueryFacade } from "./KnowledgeQueryFacade.ts";
import { ScopeResolver } from "./ScopeResolver.ts";
import { ScopeViolationError } from "../errors.ts";
import {
  DirectQueryExecutor,
  StubSemanticSearch,
  StubGetItem,
  StubListItems,
  StubListCollections,
  StubListTags,
} from "../testDoubles/index.ts";
import { CredentialScope } from "../../../identity/domain/valueObjects/CredentialScope.ts";
import { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";
import type { SearchResult } from "../../../retrieval/application/types.ts";
import type { KnowledgeItemView, CollectionView, TagView } from "../../../knowledge/application/types.ts";

const COMPANY = "company-1";

function scope(collectionIds: ReadonlyArray<string>, ceiling: string): CredentialScope {
  return CredentialScope.of(collectionIds, SensitivityLevel.of(ceiling));
}

function searchResult(itemId: string, collectionId: string): SearchResult {
  return {
    itemId,
    title: "Title " + itemId,
    collectionId,
    sensitivity: "internal",
    chunkIndex: 0,
    content: "content of " + itemId,
    score: 1,
    publishedAt: "2026-01-01T00:00:00.000Z",
    stale: false,
  };
}

function itemView(overrides: Partial<KnowledgeItemView> & { id: string }): KnowledgeItemView {
  return {
    collectionId: "a",
    title: "Title",
    body: "Body",
    tagIds: [],
    sensitivity: "internal",
    status: "Published",
    currentVersionNumber: 1,
    publishedVersionNumber: 1,
    isServed: true,
    isStale: false,
    lastRejectionReason: null,
    ...overrides,
  };
}

function buildFacade(parts: {
  search?: StubSemanticSearch;
  getItem?: StubGetItem;
  listItems?: StubListItems;
  listCollections?: StubListCollections;
  listTags?: StubListTags;
}): {
  facade: KnowledgeQueryFacade;
  search: StubSemanticSearch;
  listItems: StubListItems;
} {
  const search = parts.search ?? new StubSemanticSearch([]);
  const getItem = parts.getItem ?? new StubGetItem(new Map());
  const listItems = parts.listItems ?? new StubListItems([]);
  const listCollections = parts.listCollections ?? new StubListCollections([]);
  const listTags = parts.listTags ?? new StubListTags([]);
  const facade = new KnowledgeQueryFacade(new ScopeResolver(), new DirectQueryExecutor(), {
    semanticSearch: search,
    getItem,
    listItems,
    listCollections,
    listTags,
  });
  return { facade, search, listItems };
}

describe("KnowledgeQueryFacade.search", () => {
  it("builds a search command scoped to companyId + effective collections + ceiling", async () => {
    const { facade, search } = buildFacade({ search: new StubSemanticSearch([searchResult("i1", "a")]) });
    const response = await facade.search(COMPANY, scope(["a", "b"], "confidential"), {
      query: "anything",
      collectionIds: ["a"],
    });

    assert.equal(search.lastCommand?.companyId, COMPANY);
    assert.deepEqual(search.lastCommand?.collectionIds, ["a"]);
    assert.equal(search.lastCommand?.sensitivityCeiling, "confidential");
    assert.deepEqual(response.effectiveScope.collectionIds, ["a"]);
    assert.equal(response.effectiveScope.sensitivityCeiling, "confidential");
    assert.equal(response.results.length, 1);
  });

  it("a request naming an out-of-scope collection raises ScopeViolationError (403)", async () => {
    const { facade } = buildFacade({});
    await assert.rejects(
      () => facade.search(COMPANY, scope(["a"], "internal"), { query: "q", collectionIds: ["b"] }),
      ScopeViolationError,
    );
  });

  it("an empty credential allowlist searches an empty effective scope (fail-closed)", async () => {
    const { facade, search } = buildFacade({ search: new StubSemanticSearch([searchResult("i1", "a")]) });
    const response = await facade.search(COMPANY, scope([], "internal"), { query: "q" });
    assert.deepEqual(search.lastCommand?.collectionIds, []);
    assert.deepEqual(response.effectiveScope.collectionIds, []);
  });

  it("threads requested tags into the search command (the tag filter is real, not a no-op)", async () => {
    const { facade, search } = buildFacade({ search: new StubSemanticSearch([searchResult("i1", "a")]) });
    await facade.search(COMPANY, scope(["a"], "internal"), { query: "q", tags: ["t1", "t2"] });
    assert.deepEqual(search.lastCommand?.tagIds, ["t1", "t2"]);
  });

  it("passes null tags when none are requested (behaviour identical to a tagless search)", async () => {
    const { facade, search } = buildFacade({ search: new StubSemanticSearch([searchResult("i1", "a")]) });
    await facade.search(COMPANY, scope(["a"], "internal"), { query: "q" });
    assert.equal(search.lastCommand?.tagIds, null);
  });
});

describe("KnowledgeQueryFacade.getItem", () => {
  it("returns a served, in-scope item", async () => {
    const item = itemView({ id: "i1", collectionId: "a", sensitivity: "internal", isServed: true });
    const { facade } = buildFacade({ getItem: new StubGetItem(new Map([["i1", item]])) });
    const view = await facade.getItem(scope(["a"], "internal"), "i1");
    assert.equal(view?.id, "i1");
    assert.equal(view?.body, "Body");
  });

  it("returns null for a non-served item (never leaks a draft/archived item)", async () => {
    const item = itemView({ id: "i1", collectionId: "a", isServed: false, status: "Draft" });
    const { facade } = buildFacade({ getItem: new StubGetItem(new Map([["i1", item]])) });
    assert.equal(await facade.getItem(scope(["a"], "internal"), "i1"), null);
  });

  it("returns null for an item in a collection outside the effective scope (no metadata leak)", async () => {
    const item = itemView({ id: "i1", collectionId: "b", isServed: true });
    const { facade } = buildFacade({ getItem: new StubGetItem(new Map([["i1", item]])) });
    assert.equal(await facade.getItem(scope(["a"], "internal"), "i1"), null);
  });

  it("returns null for an item above the credential's sensitivity ceiling", async () => {
    const item = itemView({ id: "i1", collectionId: "a", sensitivity: "confidential", isServed: true });
    const { facade } = buildFacade({ getItem: new StubGetItem(new Map([["i1", item]])) });
    assert.equal(await facade.getItem(scope(["a"], "internal"), "i1"), null);
  });

  it("returns null for an unknown item id", async () => {
    const { facade } = buildFacade({});
    assert.equal(await facade.getItem(scope(["a"], "internal"), "missing"), null);
  });
});

describe("KnowledgeQueryFacade.listCollections / listTags", () => {
  it("lists only the credential's in-scope collections", async () => {
    const collections: ReadonlyArray<CollectionView> = [
      { id: "a", name: "Alpha", description: null, createdBy: "u1" },
      { id: "b", name: "Beta", description: "desc", createdBy: "u1" },
      { id: "c", name: "Gamma", description: null, createdBy: "u1" },
    ];
    const { facade } = buildFacade({ listCollections: new StubListCollections(collections) });
    const result = await facade.listCollections(scope(["a", "c"], "internal"));
    assert.deepEqual(result.map((collection) => collection.id).sort(), ["a", "c"]);
  });

  it("lists tags (the credential's taxonomy facets)", async () => {
    const tags: ReadonlyArray<TagView> = [
      { id: "t1", slug: "billing", label: "Billing", scope: "tenant" },
    ];
    const { facade } = buildFacade({ listTags: new StubListTags(tags) });
    const result = await facade.listTags(scope(["a"], "internal"));
    assert.equal(result.length, 1);
    assert.equal(result[0]?.slug, "billing");
  });
});

describe("KnowledgeQueryFacade.lookup", () => {
  it("returns only served, in-scope items matching the criteria, flagged stale when deprecated", async () => {
    const items: ReadonlyArray<KnowledgeItemView> = [
      itemView({ id: "served-a", collectionId: "a", title: "Refunds", isServed: true, status: "Published" }),
      itemView({ id: "deprecated-a", collectionId: "a", title: "Old Refunds", isServed: true, isStale: true, status: "Deprecated" }),
      itemView({ id: "draft-a", collectionId: "a", title: "Draft", isServed: false, status: "Draft" }),
      itemView({ id: "served-b", collectionId: "b", title: "Other", isServed: true, status: "Published" }),
    ];
    const { facade } = buildFacade({ listItems: new StubListItems(items) });
    const result = await facade.lookup(scope(["a"], "internal"), {});
    const ids = result.map((view) => view.id).sort();
    assert.deepEqual(ids, ["deprecated-a", "served-a"]);
    const deprecated = result.find((view) => view.id === "deprecated-a");
    assert.equal(deprecated?.stale, true);
  });

  it("filters lookup by title substring (case-insensitive)", async () => {
    const items: ReadonlyArray<KnowledgeItemView> = [
      itemView({ id: "i1", collectionId: "a", title: "Refund Policy", isServed: true }),
      itemView({ id: "i2", collectionId: "a", title: "Shipping", isServed: true }),
    ];
    const { facade } = buildFacade({ listItems: new StubListItems(items) });
    const result = await facade.lookup(scope(["a"], "internal"), { title: "refund" });
    assert.deepEqual(result.map((view) => view.id), ["i1"]);
  });

  it("filters lookup by tag id", async () => {
    const items: ReadonlyArray<KnowledgeItemView> = [
      itemView({ id: "i1", collectionId: "a", tagIds: ["t1"], isServed: true }),
      itemView({ id: "i2", collectionId: "a", tagIds: ["t2"], isServed: true }),
    ];
    const { facade } = buildFacade({ listItems: new StubListItems(items) });
    const result = await facade.lookup(scope(["a"], "internal"), { tag: "t1" });
    assert.deepEqual(result.map((view) => view.id), ["i1"]);
  });

  it("a lookup naming an out-of-scope collection raises ScopeViolationError", async () => {
    const { facade } = buildFacade({});
    await assert.rejects(
      () => facade.lookup(scope(["a"], "internal"), { collectionId: "b" }),
      ScopeViolationError,
    );
  });
});
