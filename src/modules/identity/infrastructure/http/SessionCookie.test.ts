import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_COOKIE_NAME,
  readSessionToken,
  buildSessionCookie,
  buildClearedSessionCookie,
} from "./SessionCookie.ts";

describe("SessionCookie", () => {
  it("reads the session token from a cookie header among others", () => {
    const header = "theme=dark; " + SESSION_COOKIE_NAME + "=abc.def; other=1";
    assert.equal(readSessionToken(header), "abc.def");
  });

  it("returns null when the cookie is absent, empty, or undefined", () => {
    assert.equal(readSessionToken(undefined), null);
    assert.equal(readSessionToken(""), null);
    assert.equal(readSessionToken("theme=dark"), null);
    assert.equal(readSessionToken(SESSION_COOKIE_NAME + "="), null);
  });

  it("builds an httpOnly, SameSite=Strict cookie with Max-Age", () => {
    const cookie = buildSessionCookie("tok", 3600, false);
    assert.ok(cookie.startsWith(SESSION_COOKIE_NAME + "=tok"));
    assert.ok(cookie.includes("HttpOnly"));
    assert.ok(cookie.includes("SameSite=Strict"));
    assert.ok(cookie.includes("Max-Age=3600"));
    assert.ok(!cookie.includes("Secure"));
  });

  it("adds Secure when requested (production over TLS)", () => {
    assert.ok(buildSessionCookie("tok", 3600, true).includes("Secure"));
  });

  it("clears the cookie with Max-Age=0", () => {
    assert.ok(buildClearedSessionCookie().includes("Max-Age=0"));
  });
});
