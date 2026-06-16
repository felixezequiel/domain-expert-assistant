import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MikroOrmSessionRepository } from "./MikroOrmSessionRepository.ts";
import { createFakeEntityManagerProvider } from "./testing/index.ts";
import { Session } from "../../../../domain/entities/Session.ts";
import { SessionId } from "../../../../domain/identifiers/SessionId.ts";

const NOW = new Date("2026-06-16T12:00:00.000Z");
const ONE_HOUR_MS = 60 * 60 * 1000;

function session(id: string, tokenHash: string, userId: string): Session {
  return Session.start(new SessionId(id), tokenHash, userId, "company-1", NOW, ONE_HOUR_MS);
}

describe("MikroOrmSessionRepository", () => {
  it("saves and finds by token hash", async () => {
    const repo = new MikroOrmSessionRepository(createFakeEntityManagerProvider());
    await repo.save(session("s1", "H:tok", "u1"));

    assert.equal((await repo.findByTokenHash("H:tok"))?.id.value, "s1");
    assert.equal(await repo.findByTokenHash("missing"), null);
  });

  it("revokes a single session", async () => {
    const repo = new MikroOrmSessionRepository(createFakeEntityManagerProvider());
    await repo.save(session("s1", "H:tok", "u1"));

    await repo.revoke("s1");

    assert.equal((await repo.findByTokenHash("H:tok"))?.isRevoked, true);
  });

  it("revokes all sessions for a user", async () => {
    const repo = new MikroOrmSessionRepository(createFakeEntityManagerProvider());
    await repo.save(session("s1", "H:a", "u1"));
    await repo.save(session("s2", "H:b", "u1"));
    await repo.save(session("s3", "H:c", "u2"));

    await repo.revokeAllForUser("u1");

    assert.equal((await repo.findByTokenHash("H:a"))?.isRevoked, true);
    assert.equal((await repo.findByTokenHash("H:b"))?.isRevoked, true);
    assert.equal((await repo.findByTokenHash("H:c"))?.isRevoked, false);
  });
});
