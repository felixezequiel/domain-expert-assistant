/**
 * Governance lifecycle states (ADR-013). The status describes the working version; what
 * is *served* is governed by the published-version pointer (ADR-012). Transitions are
 * guarded methods on the KnowledgeItem aggregate — this is just the vocabulary.
 */
export const LIFECYCLE_STATUSES = ["draft", "in_review", "published", "deprecated", "archived"] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export function isLifecycleStatus(value: string): value is LifecycleStatus {
  return (LIFECYCLE_STATUSES as ReadonlyArray<string>).includes(value);
}
