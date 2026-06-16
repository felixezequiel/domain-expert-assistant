/**
 * Ingestion job lifecycle (ADR-015): pending → processing → done | failed. The
 * `ingestion_jobs` table doubles as the work queue; transitions are guarded methods on
 * the IngestionJob aggregate — this is just the vocabulary.
 */
export const INGESTION_STATUSES = ["pending", "processing", "done", "failed"] as const;

export type IngestionStatus = (typeof INGESTION_STATUSES)[number];

export function isIngestionStatus(value: string): value is IngestionStatus {
  return (INGESTION_STATUSES as ReadonlyArray<string>).includes(value);
}
