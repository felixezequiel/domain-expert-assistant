import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ResolveSessionUseCase } from "./ResolveSessionUseCase.ts";
import { FakeUserRepository, FakeSessionRepository, FakeOpaqueSecret } from "../testDoubles/index.ts";
import { User } from "../../domain/aggregates/User.ts";
import { UserId } from "../../domain/identifiers/UserId.ts";
import { Email } from "../../domain/valueObjects/Email.ts";
import { DisplayName } from "../../domain/valueObjects/DisplayName.ts";
import { PasswordHash } from "../../domain/valueObjects/PasswordHash.ts";
import { Session } from "../../domain/entities/Session.ts";
import { SessionId } from "../../domain/identifiers/SessionId.ts";

const NOW = new Date("2026-06-16T12:00:00.000Z");
const ONE_HOUR_MS = 60 * 60 * 1000;

function user(status: "active" | "disabled" = "active"): User {
  return User.reconstitute(
    new UserId("u1"),
    "company-1",
    new Email("ada@acme.com"),
    new DisplayName("Ada"),
    new PasswordHash("h:secret"),
    ["admin", "curator"],
    status,
  );
}

async function buildStack(options: { user?: User; session?: Session }) {
  const userRepository = new FakeUserRepository();
  const sessionRepository = new FakeSessionRepository();
  if (options.user !== undefined) {
    await userRepository.save(options.user);
  }
  if (options.session !== undefined) {
    await sessionRepository.save(options.session);
  }
  const useCase = new ResolveSessionUseCase(
    sessionRepository,
    userRepository,
    new FakeOpaqueSecret(),
    () => NOW,
  );
  return { useCase };
}

function validSession(): Session {
  return Session.start(new SessionId("s1"), "H:tok", "u1", "company-1", NOW, ONE_HOUR_MS);
}

describe("ResolveSessionUseCase", () => {
  it("resolves a valid token to the fresh principal (roles from the User)", async () => {
    const { useCase } = await buildStack({ user: user(), session: validSession() });

    const principal = await useCase.execute("tok");

    assert.ok(principal !== null);
    assert.equal(principal.companyId, "company-1");
    assert.equal(principal.actorId, "u1");
    assert.equal(principal.actorType, "user");
    assert.deepEqual([...principal.roles].sort(), ["admin", "curator"]);
  });

  it("returns null for an unknown token", async () => {
    const { useCase } = await buildStack({ user: user(), session: validSession() });

    assert.equal(await useCase.execute("nope"), null);
  });

  it("returns null for a revoked session", async () => {
    const session = validSession();
    session.revoke();
    const { useCase } = await buildStack({ user: user(), session });

    assert.equal(await useCase.execute("tok"), null);
  });

  it("returns null for an expired session", async () => {
    const expired = Session.start(
      new SessionId("s1"),
      "H:tok",
      "u1",
      "company-1",
      new Date(NOW.getTime() - 2 * ONE_HOUR_MS),
      ONE_HOUR_MS,
    );
    const { useCase } = await buildStack({ user: user(), session: expired });

    assert.equal(await useCase.execute("tok"), null);
  });

  it("returns null when the user has been disabled (immediate revocation)", async () => {
    const { useCase } = await buildStack({ user: user("disabled"), session: validSession() });

    assert.equal(await useCase.execute("tok"), null);
  });
});
