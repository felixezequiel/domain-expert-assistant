import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ConsumptionMcpTools, McpToolContext } from "./ConsumptionMcpTools.ts";

const SERVER_NAME = "domain-expert";
const SERVER_VERSION = "1.0.0";
const RESOURCE_TEMPLATE = "knowledge://{collection}/{itemId}";

function jsonContent(payload: unknown): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text: JSON.stringify(payload) }] };
}

/**
 * Builds an MCP server bound to one consumer credential (ADR-021: the session is tied to the
 * credential at establishment). Every tool and the resource template delegate to the shared
 * `ConsumptionMcpTools` → `KnowledgeQueryFacade`, so the MCP surface enforces the exact same
 * scope and returns the exact same data as REST (parity). A fresh server is built per request
 * by the edge in stateless transport mode; the credential's scope is captured in `context`.
 *
 * Tools are actions; resources are addressable published items via the
 * `knowledge://{collection}/{itemId}` template, listed scoped + paginated (never the whole
 * base). Auth (Bearer → credential → consumer actor context) happens at the HTTP edge before
 * this server ever sees the request.
 */
export function buildConsumptionMcpServer(
  tools: ConsumptionMcpTools,
  context: McpToolContext,
): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    "search_knowledge",
    {
      description:
        "Hybrid semantic search over the knowledge base in scope. Returns ranked chunks " +
        "with attribution and freshness, plus the effective scope applied.",
      inputSchema: {
        query: z.string(),
        collectionIds: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        k: z.number().int().positive().optional(),
      },
    },
    async (args) => jsonContent(await tools.searchKnowledge(context, args)),
  );

  server.registerTool(
    "lookup_knowledge",
    {
      description: "Deterministic lookup of served, in-scope items by title, tag, or collection.",
      inputSchema: {
        title: z.string().optional(),
        tag: z.string().optional(),
        collectionId: z.string().optional(),
      },
    },
    async (args) => jsonContent(await tools.lookupKnowledge(context, args)),
  );

  server.registerTool(
    "list_collections",
    { description: "List the collections in the credential's scope.", inputSchema: {} },
    async () => jsonContent(await tools.listCollections(context)),
  );

  server.registerTool(
    "list_tags",
    { description: "List the tag facets available to the credential.", inputSchema: {} },
    async () => jsonContent(await tools.listTags(context)),
  );

  server.registerTool(
    "get_knowledge_item",
    {
      description: "Fetch one published, in-scope knowledge item by id. Returns null if out of scope.",
      inputSchema: { itemId: z.string() },
    },
    async (args) => jsonContent(await tools.getKnowledgeItem(context, args.itemId)),
  );

  server.registerResource(
    "knowledge-item",
    new ResourceTemplate(RESOURCE_TEMPLATE, {
      list: async () => {
        // The SDK's ResourceTemplate.list callback does not forward the resources/list cursor,
        // so v1 returns the first scoped page. The listing is already filtered to in-scope,
        // served items and bounded by page size — never an enumeration of the whole base
        // (ADR-021). `nextCursor` is advertised when more in-scope items exist; the cursor-aware
        // continuation path lands when the SDK surfaces the request cursor.
        const listing = await tools.listResources(context, undefined);
        const resources = listing.resources.map((resource) => ({ uri: resource.uri, name: resource.name }));
        return listing.nextCursor === undefined ? { resources } : { resources, nextCursor: listing.nextCursor };
      },
    }),
    { description: "Published knowledge items addressable as knowledge://{collection}/{itemId}." },
    async (uri) => {
      const item = await tools.readResource(context, uri.href);
      if (item === null) {
        return { contents: [] };
      }
      return {
        contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(item) }],
      };
    },
  );

  return server;
}
