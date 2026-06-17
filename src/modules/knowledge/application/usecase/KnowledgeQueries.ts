import type { UseCase } from "../../../../shared/application/UseCase.ts";
import { KnowledgeItemId } from "../../domain/identifiers/KnowledgeItemId.ts";
import type { KnowledgeItem } from "../../domain/aggregates/KnowledgeItem.ts";
import type { Tag } from "../../domain/aggregates/Tag.ts";
import type { KnowledgeVersion } from "../../domain/entities/KnowledgeVersion.ts";
import type {
  KnowledgeItemRepositoryPort,
  CollectionRepositoryPort,
  TagRepositoryPort,
  KnowledgeVersionRepositoryPort,
  KnowledgeItemFilter,
  KnowledgeItemView,
  KnowledgeVersionView,
  CollectionView,
  TagView,
} from "../types.ts";

function itemView(item: KnowledgeItem): KnowledgeItemView {
  const tagIds: Array<string> = [];
  for (const tag of item.tagIds) {
    tagIds.push(tag.value);
  }
  return {
    id: item.id.value,
    collectionId: item.collectionId.value,
    title: item.title.value,
    body: item.body.value,
    tagIds,
    sensitivity: item.sensitivity.name,
    status: item.status,
    currentVersionNumber: item.currentVersionNumber,
    publishedVersionNumber: item.publishedVersionNumber,
    isServed: item.isServed(),
    isStale: item.isStale(),
    lastRejectionReason: item.lastRejectionReason,
  };
}

function versionView(version: KnowledgeVersion): KnowledgeVersionView {
  return {
    itemId: version.itemId,
    versionNumber: version.versionNumber,
    title: version.title,
    body: version.body,
    tagIds: version.tagIds,
    sensitivity: version.sensitivity,
    createdBy: version.createdBy,
    createdAt: version.createdAt.toISOString(),
  };
}

export class GetKnowledgeItemUseCase implements UseCase<string, KnowledgeItemView | null> {
  constructor(private readonly itemRepository: KnowledgeItemRepositoryPort) {}
  public async execute(itemId: string): Promise<KnowledgeItemView | null> {
    const item = await this.itemRepository.findById(new KnowledgeItemId(itemId));
    return item === null ? null : itemView(item);
  }
}

export class ListKnowledgeItemsUseCase
  implements UseCase<KnowledgeItemFilter, ReadonlyArray<KnowledgeItemView>>
{
  constructor(private readonly itemRepository: KnowledgeItemRepositoryPort) {}
  public async execute(filter: KnowledgeItemFilter): Promise<ReadonlyArray<KnowledgeItemView>> {
    const items = await this.itemRepository.list(filter);
    const views: Array<KnowledgeItemView> = [];
    for (const item of items) {
      views.push(itemView(item));
    }
    return views;
  }
}

export class GetVersionHistoryUseCase implements UseCase<string, ReadonlyArray<KnowledgeVersionView>> {
  constructor(private readonly versionRepository: KnowledgeVersionRepositoryPort) {}
  public async execute(itemId: string): Promise<ReadonlyArray<KnowledgeVersionView>> {
    const versions = await this.versionRepository.listByItem(itemId);
    const views: Array<KnowledgeVersionView> = [];
    for (const version of versions) {
      views.push(versionView(version));
    }
    return views;
  }
}

export class ListCollectionsUseCase implements UseCase<void, ReadonlyArray<CollectionView>> {
  constructor(private readonly collectionRepository: CollectionRepositoryPort) {}
  public async execute(): Promise<ReadonlyArray<CollectionView>> {
    const collections = await this.collectionRepository.listByCompany();
    const views: Array<CollectionView> = [];
    for (const collection of collections) {
      views.push({
        id: collection.id.value,
        name: collection.name,
        description: collection.description,
        createdBy: collection.createdBy,
      });
    }
    return views;
  }
}

export class ListTagsUseCase implements UseCase<void, ReadonlyArray<TagView>> {
  constructor(private readonly tagRepository: TagRepositoryPort) {}
  public async execute(): Promise<ReadonlyArray<TagView>> {
    const tags: ReadonlyArray<Tag> = await this.tagRepository.listForTenant();
    const views: Array<TagView> = [];
    for (const tag of tags) {
      views.push({ id: tag.id.value, slug: tag.slug, label: tag.label, scope: tag.scope });
    }
    return views;
  }
}
