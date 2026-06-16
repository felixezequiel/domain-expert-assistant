const MILLISECONDS_PER_SECOND = 1000;

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

interface WindowState {
  windowStart: number;
  count: number;
}

/**
 * In-memory fixed-window rate limiter per credential (PRD-5 §9: a simple in-memory counter
 * in v1; a distributed store is a future ADR if it is ever needed). Each credential gets its
 * own window; when the window elapses the count resets. Time is injected so the limiter is
 * deterministically testable. Not durable and not shared across processes — acceptable for
 * the single-node v1 monolith.
 */
export class FixedWindowRateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly windows = new Map<string, WindowState>();

  constructor(maxRequests: number, windowMs: number, now: () => number = Date.now) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.now = now;
  }

  public check(credentialId: string): RateLimitDecision {
    const currentTime = this.now();
    const existing = this.windows.get(credentialId);

    if (existing === undefined || currentTime - existing.windowStart >= this.windowMs) {
      this.windows.set(credentialId, { windowStart: currentTime, count: 1 });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (existing.count < this.maxRequests) {
      existing.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    }

    const elapsed = currentTime - existing.windowStart;
    const remainingMs = Math.max(this.windowMs - elapsed, 0);
    const retryAfterSeconds = Math.max(Math.ceil(remainingMs / MILLISECONDS_PER_SECOND), 1);
    return { allowed: false, retryAfterSeconds };
  }
}
