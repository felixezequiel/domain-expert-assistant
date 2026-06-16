import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DisableUserUseCase } from "./DisableUserUseCase.ts";
import { DisableUserCommand } from "../command/DisableUserCommand.ts";
import { LastAdminError } from "../errors.ts";
import { FakeUserRepository, FakeSessionRepository } from "../testDoubles/index.ts";
import { User } from "../../domain/aggregates/User.ts";
import { UserId } from "../../domain/identifiers/UserId.ts";
import { Email } from "../../domain/valueObjects/Email.ts";
import { DisplayName } from "../../domain/valueObjects/DisplayName.ts";
import { PasswordHash } from "../../domain/valueObjects/PasswordHash.ts";
import { Session } from "../../domain/entities/Session.ts";
import { SessionId } from "../../domain/identifiers/SessionId.ts";
import type { Role } from "../../../../shared/domain/Role.ts";

const NOW = new Date("2026-06-16T12:00:00.000Z");
const ONE_HOUR_MS = 60 * 60 * 1000;

function user(id: string, roles: ReadonlyArray<Role>): User {
  return User.reconstitute(
    new UserId(id),
    "company-1",
    new Email(id + "@acme.com"),
    new DisplayName("X"),
    new PasswordHash("h:x"),
    roles,
    "active",
  );
}

describe("DisableUserUseCase", () => {
  it("disables a non-admin user and revokes their sessions", async () => {
    const userRepository = new FakeUserRepository();
    const sessionRepository = new FakeSessionRepository();
    await userRepository.save(user("u1", ["curator"]));
    await sessionRepository.save(Session.start(new SessionId("s1"), "h1", "u1", "company-1", NOW, ONE_HOUR_MS));
    const useCase = new DisableUserUseCase(userRepository, sessionRepository);

    const disabled = await useCase.execute(DisableUserCommand.of("u1"));

    assert.equal(disabled.status, "disabled");
    assert.equal((await sessionRepository.findByTokenHash("h1"))?.isRevoked, true);
  });

  it("refuses to disable the last active admin", async () => {
    const userRepository = new FakeUserRepository();
    await userRepository.save(user("u1", ["admin"]));
    const useCase = new DisableUserUseCase(userRepository, new FakeSessionRepository());

    await assert.rejects(() => useCase.execute(DisableUserCommand.of("u1")), LastAdminError);
  });

  it("disables an admin when another active admin remains", async () => {
    const userRepository = new FakeUserRepository();
    await userRepository.save(user("u1", ["admin"]));
    await userRepository.save(user("u2", ["admin"]));
    const useCase = new DisableUserUseCase(userRepository, new FakeSessionRepository());

    const disabled = await useCase.execute(DisableUserCommand.of("u1"));

    assert.equal(disabled.status, "disabled");
  });

  it("throws when the user does not exist", async () => {
    const useCase = new DisableUserUseCase(new FakeUserRepository(), new FakeSessionRepository());

    await assert.rejects(() => useCase.execute(DisableUserCommand.of("ghost")), /not found/);
  });
});
