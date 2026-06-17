import type {
  KnowledgeItemRepositoryPort,
  KnowledgeItemFilter,
  CollectionRepositoryPort,
  TagRepositoryPort,
  KnowledgeVersionRepositoryPort,
  OrganizationPolicyPort,
} from "../types.ts";
import type { KnowledgeItem } from "../../domain/aggregates/KnowledgeItem.ts";
import type { KnowledgeItemId } from "../../domain/identifiers/KnowledgeItemId.ts";
import type { Collection } from "../../domain/aggregates/Collection.ts";
import type { CollectionId } from "../../domain/identifiers/CollectionId.ts";
import type { Tag } from "../../domain/aggregates/Tag.ts";
import type { TagId } from "../../domain/identifiers/TagId.ts";
import type { KnowledgeVersion } from "../../domain/entities/KnowledgeVersion.ts";
import type { UserDirectoryPort } from "../../../../shared/ports/UserDirectoryPort.ts";

/**
 * In-memory port doubles for Knowledge application unit tests (hexagonal rule: app tests
 * depend on ports, not infra). Production uses the MikroORM adapters.
 */
export class FakeKnowledgeItemRepository implements KnowledgeItemRepositoryPort {
  private readonly items = new Map<string, KnowledgeItem>();

  public async save(item: KnowledgeItem): Promise<void> {
    this.items.set(item.id.value, item);
  }
  public async findById(id: KnowledgeItemId): Promise<KnowledgeItem | null> {
    return this.items.get(id.value) ?? null;
  }
  public async list(filter: KnowledgeItemFilter): Promise<ReadonlyArray<KnowledgeItem>> {
    const result: Array<KnowledgeItem> = [];
    for (const item of this.items.values()) {
      if (filter.collectionId !== null && item.collectionId.value !== filter.collectionId) {
        continue;
      }
      if (filter.status !== null && item.status !== filter.status) {
        continue;
      }
      result.push(item);
    }
    return result;
  }
  public async existsInCollection(collectionId: string): Promise<boolean> {
    for (const item of this.items.values()) {
      if (item.collectionId.value === collectionId) {
        return true;
      }
    }
    return false;
  }
  public async isTagInUse(tagId: string): Promise<boolean> {
    for (const item of this.items.values()) {
      for (const tag of item.tagIds) {
        if (tag.value === tagId) {
          return true;
        }
      }
    }
    return false;
  }
}

export class FakeCollectionRepository implements CollectionRepositoryPort {
  private readonly collections = new Map<string, Collection>();

  public async save(collection: Collection): Promise<void> {
    this.collections.set(collection.id.value, collection);
  }
  public async findById(id: CollectionId): Promise<Collection | null> {
    return this.collections.get(id.value) ?? null;
  }
  public async existsByName(name: string): Promise<boolean> {
    for (const collection of this.collections.values()) {
      if (collection.name === name) {
        return true;
      }
    }
    return false;
  }
  public async listByCompany(): Promise<ReadonlyArray<Collection>> {
    return [...this.collections.values()];
  }
}

export class FakeTagRepository implements TagRepositoryPort {
  private readonly tags = new Map<string, Tag>();

  public async save(tag: Tag): Promise<void> {
    this.tags.set(tag.id.value, tag);
  }
  public async findById(id: TagId): Promise<Tag | null> {
    return this.tags.get(id.value) ?? null;
  }
  public async existsBySlug(slug: string): Promise<boolean> {
    for (const tag of this.tags.values()) {
      if (tag.slug === slug) {
        return true;
      }
    }
    return false;
  }
  public async listForTenant(): Promise<ReadonlyArray<Tag>> {
    return [...this.tags.values()];
  }
  public async existingTagIds(tagIds: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
    const existing: Array<string> = [];
    for (const tagId of tagIds) {
      if (this.tags.has(tagId)) {
        existing.push(tagId);
      }
    }
    return existing;
  }
}

export class FakeKnowledgeVersionRepository implements KnowledgeVersionRepositoryPort {
  public readonly appended: Array<KnowledgeVersion> = [];

  public async append(version: KnowledgeVersion): Promise<void> {
    this.appended.push(version);
  }
  public async findByItemAndNumber(itemId: string, versionNumber: number): Promise<KnowledgeVersion | null> {
    for (const version of this.appended) {
      if (version.itemId === itemId && version.versionNumber === versionNumber) {
        return version;
      }
    }
    return null;
  }
  public async listByItem(itemId: string): Promise<ReadonlyArray<KnowledgeVersion>> {
    return this.appended.filter((version) => version.itemId === itemId);
  }
}

export class FakeOrganizationPolicy implements OrganizationPolicyPort {
  constructor(private readonly value: boolean) {}
  public async requireSeparateReviewer(): Promise<boolean> {
    return this.value;
  }
}

export class FakeUserDirectory implements UserDirectoryPort {
  private readonly names: ReadonlyMap<string, string>;
  constructor(names: Record<string, string> = {}) {
    this.names = new Map(Object.entries(names));
  }
  public async resolveDisplayNames(
    userIds: ReadonlyArray<string>,
  ): Promise<ReadonlyMap<string, string>> {
    const resolved = new Map<string, string>();
    for (const userId of userIds) {
      const name = this.names.get(userId);
      if (name !== undefined) {
        resolved.set(userId, name);
      }
    }
    return resolved;
  }
}
