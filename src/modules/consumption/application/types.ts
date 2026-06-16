import type { SearchResult } from "../../retrieval/application/types.ts";
import type { ConsumerCredential } from "../../identity/domain/aggregates/ConsumerCredential.ts";

/**
 * Stages a credential's `lastUsedAt` update for the unit of work to persist on commit,
 * without the use case touching infrastructure (hexagonal rule) and without a direct flush
 * (ADR-004 — the UnitOfWork owns the single flush). The production adapter registers the
 * aggregate with the request-scoped `AggregateTracker`; tests use an in-memory double.
 */
export interface CredentialUsageStagerPort {
  stage(credential: ConsumerCredential): void;
}

export interface RecordCredentialUsageCommand {
  readonly credentialId: string;
  readonly at: Date;
}

/**
 * Application types for the Consumption Gateway (PRD-5, the interface layer). The gateway
 * owns no domain aggregate; it orchestrates Retrieval's search and Knowledge's reads behind
 * a single `KnowledgeQueryFacade` (ADR-021) and enforces credential scope (ADR-022) before
 * every read. These shapes are the contract returned to consumers over REST and MCP alike.
 */

/**
 * The effective scope applied to a consumer request: the intersection of the credential's
 * allowlist with the request's optional narrowing filter (ADR-022). `collectionIds` is the
 * resolved list a query is pre-filtered to — an empty list means "nothing in scope",
 * fail-closed (never "all"). Echoed back to the consumer for transparency (PRD-5 §8).
 */
export interface EffectiveScope {
  readonly collectionIds: ReadonlyArray<string>;
  readonly sensitivityCeiling: string;
}

export interface SearchRequest {
  readonly query: string;
  readonly collectionIds?: ReadonlyArray<string> | undefined;
  readonly tags?: ReadonlyArray<string> | undefined;
  readonly k?: number | undefined;
}

export interface SearchResponse {
  readonly results: ReadonlyArray<SearchResult>;
  readonly effectiveScope: EffectiveScope;
}

export interface LookupRequest {
  readonly title?: string | undefined;
  readonly tag?: string | undefined;
  readonly collectionId?: string | undefined;
}

/**
 * A consumer-facing knowledge item (served + in scope). Deliberately a narrow projection of
 * the curation `KnowledgeItemView`: no internal lifecycle fields beyond the freshness signal
 * (`stale`) the consuming AI needs to weigh the answer.
 */
export interface ConsumerItemView {
  readonly id: string;
  readonly collectionId: string;
  readonly title: string;
  readonly body: string;
  readonly tagIds: ReadonlyArray<string>;
  readonly sensitivity: string;
  readonly stale: boolean;
}

export interface CollectionSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
}

export interface TagSummary {
  readonly id: string;
  readonly slug: string;
  readonly label: string;
}
