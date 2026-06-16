import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Session } from "./Session.ts";
import { SessionId } from "../identifiers/SessionId.ts";

const NOW = new Date("2026-06-16T12:00:00.000Z");
const ONE_HOUR_MS = 60 * 60 * 1000;

describe("Session", () => {
  it("starts valid with an expiry in the future", () => {
    const session = Session.start(new SessionId("s1"), "tokenhash", "user-1", "company-1", NOW, ONE_HOUR_MS);

    assert.equal(session.tokenHash, "tokenhash");
    assert.equal(session.userId, "user-1");
    assert.equal(session.companyId, "company-1");
    assert.equal(session.isValidAt(NOW), true);
  });

  it("is invalid once expired", () => {
    const session = Session.start(new SessionId("s1"), "h", "u", "c", NOW, ONE_HOUR_MS);
    const later = new Date(NOW.getTime() + ONE_HOUR_MS + 1);

    assert.equal(session.isValidAt(later), false);
  });

  it("is invalid once revoked", () => {
    const session = Session.start(new SessionId("s1"), "h", "u", "c", NOW, ONE_HOUR_MS);

    session.revoke();

    assert.equal(session.isRevoked, true);
    assert.equal(session.isValidAt(NOW), false);
  });

  it("reconstitutes from persisted state", () => {
    const session = Session.reconstitute(
      new SessionId("s1"),
      "h",
      "u",
      "c",
      NOW,
      new Date(NOW.getTime() + ONE_HOUR_MS),
      true,
    );

    assert.equal(session.isRevoked, true);
    assert.equal(session.isValidAt(NOW), false);
  });
});
