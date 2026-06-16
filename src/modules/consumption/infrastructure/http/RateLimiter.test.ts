import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FixedWindowRateLimiter } from "./RateLimiter.ts";

describe("FixedWindowRateLimiter", () => {
  it("allows requests up to the limit within a window", () => {
    const now = 1000;
    const limiter = new FixedWindowRateLimiter(3, 60_000, () => now);
    assert.equal(limiter.check("cred-1").allowed, true);
    assert.equal(limiter.check("cred-1").allowed, true);
    assert.equal(limiter.check("cred-1").allowed, true);
  });

  it("rejects the request that exceeds the limit and reports retry-after seconds", () => {
    const now = 1000;
    const limiter = new FixedWindowRateLimiter(2, 60_000, () => now);
    limiter.check("cred-1");
    limiter.check("cred-1");
    const blocked = limiter.check("cred-1");
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds > 0);
    assert.ok(blocked.retryAfterSeconds <= 60);
  });

  it("resets the count when the window rolls over", () => {
    let now = 1000;
    const limiter = new FixedWindowRateLimiter(1, 60_000, () => now);
    assert.equal(limiter.check("cred-1").allowed, true);
    assert.equal(limiter.check("cred-1").allowed, false);
    now = 1000 + 60_001;
    assert.equal(limiter.check("cred-1").allowed, true);
  });

  it("tracks each credential independently", () => {
    const now = 1000;
    const limiter = new FixedWindowRateLimiter(1, 60_000, () => now);
    assert.equal(limiter.check("cred-1").allowed, true);
    assert.equal(limiter.check("cred-2").allowed, true);
    assert.equal(limiter.check("cred-1").allowed, false);
  });
});
