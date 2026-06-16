import type { PublishedItemReaderPort, PublishedItem } from "../../application/types.ts";
import { getCurrentActor } from "../../../../shared/application/context/ActorContext.ts";
import type {
  GetKnowledgeItemUseCase,
  ListKnowledgeItemsUseCase,
  GetVersionHistoryUseCase,
} from "../../../knowledge/application/usecase/KnowledgeQueries.ts";
import type { KnowledgeItemView } from "../../../knowledge/application/types.ts";

/**
 * Bridges the retrieval context's `PublishedItemReaderPort` onto Knowledge's read queries,
 * without importing the Knowledge aggregates. It serves only items with a published version
 * that are not archived (ADR-013), and feeds the projection worker the body to index. The
 * served body is the item's current content; `publishedAt` is taken from the published
 * version's snapshot (freshness signal), falling back to the version number when the snapshot
 * is unavailable. Called inside the worker's system-actor transaction.
 */
export class PublishedItemReaderAdapter implements PublishedItemReaderPort {
  private readonly getKnowledgeItem: GetKnowledgeItemUseCase;
  private readonly listKnowledgeItems: ListKnowledgeItemsUseCase;
  private readonly getVersionHistory: GetVersionHistoryUseCase;

  constructor(
    getKnowledgeItem: GetKnowledgeItemUseCase,
    listKnowledgeItems: ListKnowledgeItemsUseCase,
    getVersionHistory: GetVersionHistoryUseCase,
  ) {
    this.getKnowledgeItem = getKnowledgeItem;
    this.listKnowledgeItems = listKnowledgeItems;
    this.getVersionHistory = getVersionHistory;
  }

  public async getPublishedItem(itemId: string): Promise<PublishedItem | null> {
    const view = await this.getKnowledgeItem.execute(itemId);
    if (view === null || !view.isServed || view.publishedVersionNumber === null) {
      return null;
    }
    return this.toPublishedItem(view, view.publishedVersionNumber);
  }

  public async listServedItems(_companyId: string): Promise<ReadonlyArray<PublishedItem>> {
    // Tenant scoping is applied by the company filter from the worker's actor context, so the
    // explicit companyId is not used to query; it stays in the port for non-context callers.
    const views = await this.listKnowledgeItems.execute({ collectionId: null, status: null });
    const items: Array<PublishedItem> = [];
    for (const view of views) {
      if (view.isServed && view.publishedVersionNumber !== null) {
        items.push(await this.toPublishedItem(view, view.publishedVersionNumber));
      }
    }
    return items;
  }

  private async toPublishedItem(
    view: KnowledgeItemView,
    publishedVersion: number,
  ): Promise<PublishedItem> {
    const publishedAt = await this.resolvePublishedAt(view.id, publishedVersion);
    return {
      itemId: view.id,
      companyId: getCurrentActor()?.companyId ?? "",
      collectionId: view.collectionId,
      title: view.title,
      body: view.body,
      sensitivity: view.sensitivity,
      publishedVersion,
      publishedAt,
      stale: view.isStale,
    };
  }

  private async resolvePublishedAt(itemId: string, publishedVersion: number): Promise<string> {
    const versions = await this.getVersionHistory.execute(itemId);
    for (const version of versions) {
      if (version.versionNumber === publishedVersion) {
        return version.createdAt;
      }
    }
    return new Date(0).toISOString();
  }
}
