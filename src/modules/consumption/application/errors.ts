/**
 * Application errors for the Consumption Gateway (PRD-5). These carry a stable code + kind
 * (ADR-026) the edge serializes via `toErrorResponse`: a `ScopeViolationError` is a 403
 * (`forbidden` — the request named a collection outside the credential's allowlist; the
 * request may only narrow, never widen, ADR-022); a `RateLimitExceededError` is a 429
 * (`rate_limited`).
 */

import { DomainError } from "../../../shared/domain/errors/DomainError.ts";

export class ScopeViolationError extends DomainError {
  public readonly collectionId: string;

  constructor(collectionId: string) {
    super(
      "consumption.scopeViolation",
      "forbidden",
      { collectionId },
      "Scope violation: collection '" +
        collectionId +
        "' is outside the credential's allowed scope.",
    );
    this.name = "ScopeViolationError";
    this.collectionId = collectionId;
  }
}

export class RateLimitExceededError extends DomainError {
  public readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(
      "consumption.rateLimitExceeded",
      "rate_limited",
      { retryAfterSeconds },
      "Rate limit exceeded. Retry after " + String(retryAfterSeconds) + " seconds.",
    );
    this.name = "RateLimitExceededError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
