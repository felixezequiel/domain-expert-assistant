import type { KnowledgeItem } from "../domain/aggregates/KnowledgeItem.ts";
import type { KnowledgeItemId } from "../domain/identifiers/KnowledgeItemId.ts";
import type { Collection } from "../domain/aggregates/Collection.ts";
import type { CollectionId } from "../domain/identifiers/CollectionId.ts";
import type { Tag } from "../domain/aggregates/Tag.ts";
import type { TagId } from "../domain/identifiers/TagId.ts";
import type { KnowledgeVersion } from "../domain/entities/KnowledgeVersion.ts";

/**
 * Secondary ports for the Knowledge context. Tenant isolation comes from the company
 * filter the unit of work sets per command; reads are filtered the same way. Aggregate
 * `save` is invoked by the unit-of-work adapter at commit (aggregates auto-persist via
 * tracking — each has a registered `AggregatePersister`); repositories never call `flush()`,
 * which the UnitOfWork owns (ADR-004). The version store is append-only and staged with
 * `em.persist()` within the same transaction as the item (ADR-012).
 */
export interface KnowledgeItemRepositoryPort {
  save(item: KnowledgeItem): Promise<void>;
  findById(id: KnowledgeItemId): Promise<KnowledgeItem | null>;
  list(filter: KnowledgeItemFilter): Promise<ReadonlyArray<KnowledgeItem>>;
  existsInCollection(collectionId: string): Promise<boolean>;
  isTagInUse(tagId: string): Promise<boolean>;
}

export interface KnowledgeItemFilter {
  readonly collectionId: string | null;
  readonly status: string | null;
}

export interface CollectionRepositoryPort {
  save(collection: Collection): Promise<void>;
  findById(id: CollectionId): Promise<Collection | null>;
  existsByName(name: string): Promise<boolean>;
  listByCompany(): Promise<ReadonlyArray<Collection>>;
}

export interface TagRepositoryPort {
  save(tag: Tag): Promise<void>;
  findById(id: TagId): Promise<Tag | null>;
  existsBySlug(slug: string): Promise<boolean>;
  // Own tenant tags ∪ immutable system tags (ADR-014).
  listForTenant(): Promise<ReadonlyArray<Tag>>;
  // Which of the requested tag ids exist in the tenant's taxonomy (own ∪ system).
  existingTagIds(tagIds: ReadonlyArray<string>): Promise<ReadonlyArray<string>>;
}

export interface KnowledgeVersionRepositoryPort {
  append(version: KnowledgeVersion): Promise<void>;
  findByItemAndNumber(itemId: string, versionNumber: number): Promise<KnowledgeVersion | null>;
  listByItem(itemId: string): Promise<ReadonlyArray<KnowledgeVersion>>;
}

/**
 * Lets the Knowledge approval flow read the org's `requireSeparateReviewer` policy without
 * importing the Identity Organization aggregate (ADR-013). Identity provides the adapter.
 */
export interface OrganizationPolicyPort {
  requireSeparateReviewer(companyId: string): Promise<boolean>;
}

// --- Read views (curation UI; consumer-facing read is PRD-5) ---

export interface KnowledgeItemView {
  readonly id: string;
  readonly collectionId: string;
  readonly title: string;
  readonly body: string;
  readonly tagIds: ReadonlyArray<string>;
  readonly sensitivity: string;
  readonly status: string;
  readonly currentVersionNumber: number;
  readonly publishedVersionNumber: number | null;
  readonly isServed: boolean;
  readonly isStale: boolean;
  // The reviewer's reason from the most recent rejection (null once re-submitted).
  readonly lastRejectionReason: string | null;
}

export interface KnowledgeVersionView {
  readonly itemId: string;
  readonly versionNumber: number;
  readonly title: string;
  readonly body: string;
  readonly tagIds: ReadonlyArray<string>;
  readonly sensitivity: string;
  readonly createdBy: string;
  // The author's display name, resolved from the user directory (null when it cannot be
  // resolved — e.g. a system author — so the UI falls back to the id).
  readonly createdByName: string | null;
  readonly createdAt: string;
}

export interface CollectionView {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly createdBy: string;
}

export interface TagView {
  readonly id: string;
  readonly slug: string;
  readonly label: string;
  readonly scope: string;
}
