import type { CredentialScope } from "../../../identity/domain/valueObjects/CredentialScope.ts";
import type { KnowledgeQueryFacade } from "../../application/service/KnowledgeQueryFacade.ts";
import type { ConsumerItemView } from "../../application/types.ts";

const DEFAULT_RESOURCE_PAGE_SIZE = 50;

export interface McpToolContext {
  readonly companyId: string;
  readonly credentialScope: CredentialScope;
}

export interface ResourceListing {
  readonly resources: ReadonlyArray<{ readonly uri: string; readonly name: string }>;
  readonly nextCursor: string | undefined;
}

/**
 * The MCP tool/resource bodies, delegating every call to the single `KnowledgeQueryFacade`
 * (ADR-021 parity: the REST edge calls the same facade, so both surfaces enforce the same
 * scope and return the same data). Kept transport-free and unit-testable; the SDK wiring in
 * `buildConsumptionMcpServer` is a thin adapter over these. The resource URI scheme is
 * `knowledge://{collection}/{itemId}`; listing is scoped + paginated, never a full
 * enumeration (ADR-021).
 */
export class ConsumptionMcpTools {
  private readonly facade: KnowledgeQueryFacade;
  private readonly pageSize: number;

  constructor(facade: KnowledgeQueryFacade, pageSize: number = DEFAULT_RESOURCE_PAGE_SIZE) {
    this.facade = facade;
    this.pageSize = pageSize;
  }

  public searchKnowledge(
    context: McpToolContext,
    args: {
      query: string;
      collectionIds?: ReadonlyArray<string> | undefined;
      tags?: ReadonlyArray<string> | undefined;
      k?: number | undefined;
    },
  ): Promise<unknown> {
    return this.facade.search(context.companyId, context.credentialScope, {
      query: args.query,
      collectionIds: args.collectionIds,
      tags: args.tags,
      k: args.k,
    });
  }

  public lookupKnowledge(
    context: McpToolContext,
    args: { title?: string | undefined; tag?: string | undefined; collectionId?: string | undefined },
  ): Promise<ReadonlyArray<ConsumerItemView>> {
    return this.facade.lookup(context.credentialScope, {
      title: args.title,
      tag: args.tag,
      collectionId: args.collectionId,
    });
  }

  public listCollections(context: McpToolContext): Promise<unknown> {
    return this.facade.listCollections(context.credentialScope);
  }

  public listTags(context: McpToolContext): Promise<unknown> {
    return this.facade.listTags(context.credentialScope);
  }

  public getKnowledgeItem(context: McpToolContext, itemId: string): Promise<ConsumerItemView | null> {
    return this.facade.getItem(context.credentialScope, itemId);
  }

  /**
   * Scoped + paginated resource listing (ADR-021: never enumerate the whole base). Lists
   * served, in-scope items as `knowledge://{collection}/{itemId}` URIs, a page at a time,
   * with an opaque numeric cursor (offset into the deterministic, sorted in-scope set).
   */
  public async listResources(context: McpToolContext, cursor: string | undefined): Promise<ResourceListing> {
    const items = await this.facade.lookup(context.credentialScope, {});
    const sorted = [...items].sort((left, right) => ConsumptionMcpTools.compareItems(left, right));
    const offset = ConsumptionMcpTools.parseCursor(cursor);
    const page = sorted.slice(offset, offset + this.pageSize);
    const resources = page.map((item) => ({
      uri: ConsumptionMcpTools.itemUri(item),
      name: item.title,
    }));
    const nextOffset = offset + this.pageSize;
    const nextCursor = nextOffset < sorted.length ? String(nextOffset) : undefined;
    return { resources, nextCursor };
  }

  /**
   * Reads one resource by its `knowledge://{collection}/{itemId}` URI, delegating to
   * `getItem` (fail-closed scope check). Returns null for a malformed URI or an
   * out-of-scope / non-served item — the caller surfaces that as not-found, no leak.
   */
  public async readResource(context: McpToolContext, uri: string): Promise<ConsumerItemView | null> {
    const itemId = ConsumptionMcpTools.parseItemUri(uri);
    if (itemId === null) {
      return null;
    }
    return this.facade.getItem(context.credentialScope, itemId);
  }

  public static itemUri(item: ConsumerItemView): string {
    return "knowledge://" + encodeURIComponent(item.collectionId) + "/" + encodeURIComponent(item.id);
  }

  private static parseItemUri(uri: string): string | null {
    const prefix = "knowledge://";
    if (!uri.startsWith(prefix)) {
      return null;
    }
    const remainder = uri.slice(prefix.length);
    const separator = remainder.indexOf("/");
    if (separator === -1) {
      return null;
    }
    const rawItemId = remainder.slice(separator + 1);
    if (rawItemId.length === 0) {
      return null;
    }
    return decodeURIComponent(rawItemId);
  }

  private static parseCursor(cursor: string | undefined): number {
    if (cursor === undefined) {
      return 0;
    }
    const parsed = Number.parseInt(cursor, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      return 0;
    }
    return parsed;
  }

  private static compareItems(left: ConsumerItemView, right: ConsumerItemView): number {
    if (left.collectionId !== right.collectionId) {
      return left.collectionId < right.collectionId ? -1 : 1;
    }
    if (left.id === right.id) {
      return 0;
    }
    return left.id < right.id ? -1 : 1;
  }
}
