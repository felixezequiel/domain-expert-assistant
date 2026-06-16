/**
 * Application errors for the Consumption Gateway (PRD-5). These map to HTTP/MCP status at
 * the edge: a `ScopeViolationError` is a 403 (the request named a collection outside the
 * credential's allowlist — the request may only narrow, never widen, ADR-022); a
 * `RateLimitExceededError` is a 429.
 */

export class ScopeViolationError extends Error {
  public readonly collectionId: string;

  constructor(collectionId: string) {
    super(
      "Scope violation: collection '" +
        collectionId +
        "' is outside the credential's allowed scope.",
    );
    this.name = "ScopeViolationError";
    this.collectionId = collectionId;
  }
}

export class RateLimitExceededError extends Error {
  public readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Rate limit exceeded. Retry after " + String(retryAfterSeconds) + " seconds.");
    this.name = "RateLimitExceededError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
