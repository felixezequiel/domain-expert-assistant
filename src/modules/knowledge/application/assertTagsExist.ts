import type { TagRepositoryPort } from "./types.ts";
import type { TagId } from "../domain/identifiers/TagId.ts";
import { DomainError } from "../../../shared/domain/errors/DomainError.ts";

/**
 * Validates that every requested tag exists in the tenant's taxonomy (own ∪ system,
 * ADR-014). Throws naming the missing ids. Shared by create/retag.
 */
export async function assertTagsExist(
  tagRepository: TagRepositoryPort,
  tagIds: ReadonlyArray<TagId>,
): Promise<void> {
  if (tagIds.length === 0) {
    return;
  }
  const requested: Array<string> = [];
  for (const tagId of tagIds) {
    requested.push(tagId.value);
  }
  const existing = new Set(await tagRepository.existingTagIds(requested));
  const missing: Array<string> = [];
  for (const id of requested) {
    if (!existing.has(id)) {
      missing.push(id);
    }
  }
  if (missing.length > 0) {
    throw new DomainError(
      "knowledge.unknownTags",
      "validation",
      { tags: missing.join(", ") },
      "Unknown tag(s) for this organization: " + missing.join(", "),
    );
  }
}
