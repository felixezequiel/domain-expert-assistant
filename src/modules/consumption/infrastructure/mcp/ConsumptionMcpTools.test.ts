import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ConsumptionMcpTools, type McpToolContext } from "./ConsumptionMcpTools.ts";
import { KnowledgeQueryFacade } from "../../application/service/KnowledgeQueryFacade.ts";
import { ScopeResolver } from "../../application/service/ScopeResolver.ts";
import {
  DirectQueryExecutor,
  StubSemanticSearch,
  StubGetItem,
  StubListItems,
  StubListCollections,
  StubListTags,
} from "../../application/testDoubles/index.ts";
import { CredentialScope } from "../../../identity/domain/valueObjects/CredentialScope.ts";
import { SensitivityLevel } from "../../../../shared/domain/valueObjects/SensitivityLevel.ts";
import type { KnowledgeItemView } from "../../../knowledge/application/types.ts";

const COMPANY = "company-1";

function context(collectionIds: ReadonlyArray<string>, ceiling: string): McpToolContext {
  return {
    companyId: COMPANY,
    credentialScope: CredentialScope.of(collectionIds, SensitivityLevel.of(ceiling)),
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

function buildTools(items: ReadonlyArray<KnowledgeItemView>, pageSize = 50): ConsumptionMcpTools {
  const facade = new KnowledgeQueryFacade(new ScopeResolver(), new DirectQueryExecutor(), {
    semanticSearch: new StubSemanticSearch([]),
    getItem: new StubGetItem(new Map(items.map((item) => [item.id, item]))),
    listItems: new StubListItems(items),
    listCollections: new StubListCollections([]),
    listTags: new StubListTags([]),
  });
  return new ConsumptionMcpTools(facade, pageSize);
}

describe("ConsumptionMcpTools.readResource", () => {
  it("reads an in-scope item via its knowledge:// URI", async () => {
    const tools = buildTools([itemView({ id: "i1", collectionId: "a", isServed: true })]);
    const view = await tools.readResource(context(["a"], "internal"), "knowledge://a/i1");
    assert.equal(view?.id, "i1");
  });

  it("returns null for an out-of-scope item URI (no leak)", async () => {
    const tools = buildTools([itemView({ id: "i1", collectionId: "b", isServed: true })]);
    assert.equal(await tools.readResource(context(["a"], "internal"), "knowledge://b/i1"), null);
  });

  it("returns null for a malformed URI", async () => {
    const tools = buildTools([]);
    assert.equal(await tools.readResource(context(["a"], "internal"), "http://a/i1"), null);
    assert.equal(await tools.readResource(context(["a"], "internal"), "knowledge://a"), null);
  });

  it("round-trips a URI built by itemUri", async () => {
    const item = itemView({ id: "item with space", collectionId: "col/1", isServed: true });
    const tools = buildTools([item]);
    const uri = ConsumptionMcpTools.itemUri({
      id: item.id,
      collectionId: item.collectionId,
      title: item.title,
      body: item.body,
      tagIds: item.tagIds,
      sensitivity: item.sensitivity,
      stale: item.isStale,
    });
    const view = await tools.readResource(context(["col/1"], "internal"), uri);
    assert.equal(view?.id, "item with space");
  });
});

describe("ConsumptionMcpTools.listResources", () => {
  it("lists only served, in-scope items as knowledge:// URIs", async () => {
    const tools = buildTools([
      itemView({ id: "i1", collectionId: "a", isServed: true }),
      itemView({ id: "i2", collectionId: "b", isServed: true }),
      itemView({ id: "i3", collectionId: "a", isServed: false }),
    ]);
    const listing = await tools.listResources(context(["a"], "internal"), undefined);
    assert.deepEqual(listing.resources.map((resource) => resource.uri), ["knowledge://a/i1"]);
    assert.equal(listing.nextCursor, undefined);
  });

  it("paginates with an opaque cursor without enumerating the whole base at once", async () => {
    const items = [
      itemView({ id: "i1", collectionId: "a", isServed: true }),
      itemView({ id: "i2", collectionId: "a", isServed: true }),
      itemView({ id: "i3", collectionId: "a", isServed: true }),
    ];
    const tools = buildTools(items, 2);
    const firstPage = await tools.listResources(context(["a"], "internal"), undefined);
    assert.equal(firstPage.resources.length, 2);
    assert.equal(firstPage.nextCursor, "2");

    const secondPage = await tools.listResources(context(["a"], "internal"), firstPage.nextCursor);
    assert.equal(secondPage.resources.length, 1);
    assert.equal(secondPage.nextCursor, undefined);
  });
});

describe("ConsumptionMcpTools parity", () => {
  it("getKnowledgeItem delegates to the same facade scope rules as the REST path", async () => {
    const tools = buildTools([itemView({ id: "i1", collectionId: "a", sensitivity: "confidential", isServed: true })]);
    // ceiling internal < confidential -> not visible
    assert.equal(await tools.getKnowledgeItem(context(["a"], "internal"), "i1"), null);
  });
});
