import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CookieSessionResolver } from "./CookieSessionResolver.ts";
import { SESSION_COOKIE_NAME } from "./SessionCookie.ts";
import type { ResolveSessionUseCase } from "../../application/usecase/ResolveSessionUseCase.ts";
import type { ResolvedPrincipal } from "../../application/types.ts";

function fakeResolveSession(
  resolve: (token: string) => Promise<ResolvedPrincipal | null>,
): ResolveSessionUseCase {
  return { execute: resolve } as unknown as ResolveSessionUseCase;
}

describe("CookieSessionResolver", () => {
  it("maps a resolved principal to an Actor for a valid session cookie", async () => {
    const principal: ResolvedPrincipal = {
      companyId: "c1",
      actorId: "u1",
      actorType: "user",
      roles: ["admin"],
    };
    let seenToken: string | null = null;
    const resolver = new CookieSessionResolver(
      fakeResolveSession(async (token) => {
        seenToken = token;
        return principal;
      }),
    );

    const actor = await resolver.resolve(SESSION_COOKIE_NAME + "=good-token");

    assert.equal(seenToken, "good-token");
    assert.deepEqual(actor, {
      companyId: "c1",
      actorId: "u1",
      actorType: "user",
      roles: ["admin"],
    });
  });

  it("returns null when there is no session token in the cookie header", async () => {
    let called = false;
    const resolver = new CookieSessionResolver(
      fakeResolveSession(async () => {
        called = true;
        return null;
      }),
    );

    const actor = await resolver.resolve(undefined);

    assert.equal(actor, null);
    assert.equal(called, false, "ResolveSessionUseCase must not run without a token");
  });

  it("returns null when the token resolves to no live principal", async () => {
    const resolver = new CookieSessionResolver(fakeResolveSession(async () => null));

    const actor = await resolver.resolve(SESSION_COOKIE_NAME + "=stale-token");

    assert.equal(actor, null);
  });
});
