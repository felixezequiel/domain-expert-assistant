import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SessionMapper } from "./SessionMapper.ts";
import { Session } from "../../../../domain/entities/Session.ts";
import { SessionId } from "../../../../domain/identifiers/SessionId.ts";

describe("SessionMapper", () => {
  it("round-trips a session", () => {
    const original = Session.reconstitute(
      new SessionId("s1"),
      "token-hash",
      "u1",
      "company-1",
      new Date("2026-06-16T12:00:00.000Z"),
      new Date("2026-06-16T13:00:00.000Z"),
      true,
    );

    const domain = SessionMapper.toDomain(SessionMapper.toOrmEntity(original));

    assert.equal(domain.id.value, "s1");
    assert.equal(domain.tokenHash, "token-hash");
    assert.equal(domain.userId, "u1");
    assert.equal(domain.companyId, "company-1");
    assert.equal(domain.isRevoked, true);
    assert.equal(domain.expiresAt.toISOString(), "2026-06-16T13:00:00.000Z");
  });
});
