import { KnowledgeVersion } from "../domain/entities/KnowledgeVersion.ts";
import type { KnowledgeItem } from "../domain/aggregates/KnowledgeItem.ts";

/**
 * Builds an append-only version snapshot from an item's current working content (ADR-012).
 * Called by content-changing use cases after the aggregate bumps its version, then appended
 * within the same transaction.
 */
export function snapshotOf(item: KnowledgeItem, createdBy: string, createdAt: Date): KnowledgeVersion {
  const tagIds: Array<string> = [];
  for (const tag of item.tagIds) {
    tagIds.push(tag.value);
  }
  return new KnowledgeVersion({
    itemId: item.id.value,
    versionNumber: item.currentVersionNumber,
    title: item.title.value,
    body: item.body.value,
    tagIds,
    sensitivity: item.sensitivity.name,
    createdBy,
    createdAt,
  });
}
