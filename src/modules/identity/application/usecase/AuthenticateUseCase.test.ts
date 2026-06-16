import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AuthenticateUseCase, InvalidCredentialsError } from "./AuthenticateUseCase.ts";
import { AuthenticateCommand } from "../command/AuthenticateCommand.ts";
import { FakeUserRepository, FakeSessionRepository, FakePasswordHasher, FakeOpaqueSecret } from "../testDoubles/index.ts";
import { User } from "../../domain/aggregates/User.ts";
import { UserId } from "../../domain/identifiers/UserId.ts";
import { Email } from "../../domain/valueObjects/Email.ts";
import { DisplayName } from "../../domain/valueObjects/DisplayName.ts";
import { PasswordHash } from "../../domain/valueObjects/PasswordHash.ts";

const NOW = new Date("2026-06-16T12:00:00.000Z");
const ONE_HOUR_MS = 60 * 60 * 1000;

function activeUser(): User {
  const user = User.invite(
    new UserId("u1"),
    "company-1",
    new Email("ada@acme.com"),
    new DisplayName("Ada"),
    ["admin"],
  );
  user.activate(new PasswordHash("h:secret"));
  return user;
}

async function buildStack(user: User | null) {
  const userRepository = new FakeUserRepository();
  const sessionRepository = new FakeSessionRepository();
  if (user !== null) {
    await userRepository.save(user);
  }
  const useCase = new AuthenticateUseCase(
    userRepository,
    sessionRepository,
    new FakePasswordHasher(),
    new FakeOpaqueSecret(),
    ONE_HOUR_MS,
    () => NOW,
  );
  return { useCase, sessionRepository };
}

describe("AuthenticateUseCase", () => {
  it("authenticates a valid user and mints a session, returning the token once", async () => {
    const { useCase, sessionRepository } = await buildStack(activeUser());

    const result = await useCase.execute(AuthenticateCommand.of("ada@acme.com", "secret"));

    assert.equal(result.token, "tok-1");
    assert.equal(result.userId, "u1");
    assert.equal(result.companyId, "company-1");
    assert.equal(result.expiresAt.getTime(), NOW.getTime() + ONE_HOUR_MS);

    const stored = await sessionRepository.findByTokenHash("H:tok-1");
    assert.ok(stored !== null);
    assert.equal(stored.userId, "u1");
  });

  it("rejects a wrong password indistinguishably", async () => {
    const { useCase } = await buildStack(activeUser());

    await assert.rejects(
      () => useCase.execute(AuthenticateCommand.of("ada@acme.com", "wrong")),
      InvalidCredentialsError,
    );
  });

  it("rejects an unknown email with the same error", async () => {
    const { useCase } = await buildStack(null);

    await assert.rejects(
      () => useCase.execute(AuthenticateCommand.of("nobody@acme.com", "secret")),
      InvalidCredentialsError,
    );
  });

  it("rejects a disabled user with the same error", async () => {
    const disabled = activeUser();
    disabled.disable();
    const { useCase } = await buildStack(disabled);

    await assert.rejects(
      () => useCase.execute(AuthenticateCommand.of("ada@acme.com", "secret")),
      InvalidCredentialsError,
    );
  });
});
