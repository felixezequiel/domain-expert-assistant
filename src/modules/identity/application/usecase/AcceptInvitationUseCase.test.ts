import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AcceptInvitationUseCase } from "./AcceptInvitationUseCase.ts";
import { AcceptInvitationCommand } from "../command/AcceptInvitationCommand.ts";
import { InvalidInvitationError } from "../errors.ts";
import { FakeUserRepository, FakePasswordHasher, FakeOpaqueSecret } from "../testDoubles/index.ts";
import { User } from "../../domain/aggregates/User.ts";
import { UserId } from "../../domain/identifiers/UserId.ts";
import { Email } from "../../domain/valueObjects/Email.ts";
import { DisplayName } from "../../domain/valueObjects/DisplayName.ts";
import { PasswordHash } from "../../domain/valueObjects/PasswordHash.ts";

function invitedUser(): User {
  // The use case hashes the presented token with the fake ("H:" + token), so seed the
  // invited user with the hash of "the-token".
  return User.invite(
    new UserId("u1"),
    "company-1",
    new Email("ada@acme.com"),
    new DisplayName("Ada"),
    ["curator"],
    "H:the-token",
  );
}

async function build(seed: User | null) {
  const userRepository = new FakeUserRepository();
  if (seed !== null) {
    await userRepository.save(seed);
  }
  return new AcceptInvitationUseCase(userRepository, new FakePasswordHasher(), new FakeOpaqueSecret());
}

describe("AcceptInvitationUseCase", () => {
  it("activates the invited user, setting the password and clearing the token", async () => {
    const useCase = await build(invitedUser());

    const user = await useCase.execute(AcceptInvitationCommand.of("the-token", "newpass"));

    assert.equal(user.status, "active");
    assert.equal(user.passwordHash?.value, "h:newpass");
    assert.equal(user.invitationTokenHash, null);
    assert.equal(user.getDomainEvents().some((event) => event.eventName === "UserActivated"), true);
  });

  it("rejects an unknown token", async () => {
    const useCase = await build(invitedUser());

    await assert.rejects(
      () => useCase.execute(AcceptInvitationCommand.of("wrong-token", "newpass")),
      InvalidInvitationError,
    );
  });

  it("rejects a token for an already-active user", async () => {
    const active = User.reconstitute(
      new UserId("u1"),
      "company-1",
      new Email("ada@acme.com"),
      new DisplayName("Ada"),
      new PasswordHash("h:old"),
      ["curator"],
      "active",
      "H:the-token",
    );
    const useCase = await build(active);

    await assert.rejects(
      () => useCase.execute(AcceptInvitationCommand.of("the-token", "newpass")),
      InvalidInvitationError,
    );
  });
});
