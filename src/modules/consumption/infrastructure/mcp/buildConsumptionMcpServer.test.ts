import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildConsumptionMcpServer } from "./buildConsumptionMcpServer.ts";
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
import type { SearchResult } from "../../../retrieval/application/types.ts";

const COMPANY = "company-1";

function context(): McpToolContext {
  return { companyId: COMPANY, credentialScope: CredentialScope.of(["a"], SensitivityLevel.of("internal")) };
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

function searchResult(itemId: string): SearchResult {
  return {
    itemId,
    title: "Title " + itemId,
    collectionId: "a",
    sensitivity: "internal",
    chunkIndex: 0,
    content: "content " + itemId,
    score: 1,
    publishedAt: "2026-01-01T00:00:00.000Z",
    stale: false,
  };
}

async function connectedClient(items: ReadonlyArray<KnowledgeItemView>, searchResults: ReadonlyArray<SearchResult>) {
  const facade = new KnowledgeQueryFacade(new ScopeResolver(), new DirectQueryExecutor(), {
    semanticSearch: new StubSemanticSearch(searchResults),
    getItem: new StubGetItem(new Map(items.map((item) => [item.id, item]))),
    listItems: new StubListItems(items),
    listCollections: new StubListCollections([
      { id: "a", name: "Alpha", description: null, createdBy: "u1" },
    ]),
    listTags: new StubListTags([{ id: "t1", slug: "billing", label: "Billing", scope: "tenant" }]),
  });
  const server = buildConsumptionMcpServer(new ConsumptionMcpTools(facade), context());
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(clientTransport);
  return { client };
}

function parseToolText(result: unknown): unknown {
  const content = (result as { content: Array<{ type: string; text: string }> }).content;
  return JSON.parse(content[0]!.text);
}

describe("buildConsumptionMcpServer (driven over an in-memory MCP client)", () => {
  it("lists the five tools", async () => {
    const { client } = await connectedClient([], []);
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, [
      "get_knowledge_item",
      "list_collections",
      "list_tags",
      "lookup_knowledge",
      "search_knowledge",
    ]);
  });

  it("tools/call search_knowledge returns results plus the effective scope", async () => {
    const { client } = await connectedClient([], [searchResult("i1")]);
    const result = await client.callTool({ name: "search_knowledge", arguments: { query: "hello" } });
    const payload = parseToolText(result) as { results: Array<{ itemId: string }>; effectiveScope: { collectionIds: string[] } };
    assert.equal(payload.results[0]?.itemId, "i1");
    assert.deepEqual(payload.effectiveScope.collectionIds, ["a"]);
  });

  it("tools/call get_knowledge_item returns an in-scope item", async () => {
    const { client } = await connectedClient([itemView({ id: "i1", isServed: true })], []);
    const result = await client.callTool({ name: "get_knowledge_item", arguments: { itemId: "i1" } });
    const payload = parseToolText(result) as { id: string } | null;
    assert.equal(payload?.id, "i1");
  });

  it("resources/list returns scoped knowledge:// URIs", async () => {
    const { client } = await connectedClient(
      [itemView({ id: "i1", collectionId: "a", isServed: true })],
      [],
    );
    const { resources } = await client.listResources();
    assert.deepEqual(resources.map((resource) => resource.uri), ["knowledge://a/i1"]);
  });

  it("resources/read returns the item body for an in-scope URI", async () => {
    const { client } = await connectedClient([itemView({ id: "i1", collectionId: "a", isServed: true })], []);
    const result = await client.readResource({ uri: "knowledge://a/i1" });
    assert.equal(result.contents.length, 1);
    const content = result.contents[0] as { text: string };
    const body = JSON.parse(content.text) as { id: string };
    assert.equal(body.id, "i1");
  });
});
