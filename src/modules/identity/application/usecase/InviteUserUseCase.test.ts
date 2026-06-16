import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { InviteUserUseCase } from "./InviteUserUseCase.ts";
import { InviteUserCommand } from "../command/InviteUserCommand.ts";
import { FakeUserRepository, FakeOpaqueSecret } from "../testDoubles/index.ts";
import { User } from "../../domain/aggregates/User.ts";
import { UserId } from "../../domain/identifiers/UserId.ts";
import { Email } from "../../domain/valueObjects/Email.ts";
import { DisplayName } from "../../domain/valueObjects/DisplayName.ts";
import { runWithActor } from "../../../../shared/application/context/ActorContext.ts";

const ADMIN_SCOPE = { companyId: "company-1", actorId: "admin", actorType: "user" as const, roles: ["admin" as const] };

describe("InviteUserUseCase", () => {
  it("declares the admin role requirement", () => {
    assert.deepEqual([...new InviteUserUseCase(new FakeUserRepository(), new FakeOpaqueSecret()).requiredRoles], [
      "admin",
    ]);
  });

  it("invites a user into the admin's tenant with a hashed token, returning the token once", async () => {
    const useCase = new InviteUserUseCase(new FakeUserRepository(), new FakeOpaqueSecret());

    const result = await runWithActor(ADMIN_SCOPE, () =>
      useCase.execute(InviteUserCommand.of("u-new", "new@acme.com", "New", ["curator"])),
    );

    assert.equal(result.invitationToken, "tok-1");
    assert.equal(result.user.companyId, "company-1");
    assert.equal(result.user.status, "invited");
    assert.equal(result.user.invitationTokenHash, "H:tok-1");
  });

  it("rejects a duplicate email", async () => {
    const userRepository = new FakeUserRepository();
    await userRepository.save(
      User.invite(new UserId("u1"), "company-1", new Email("new@acme.com"), new DisplayName("X"), ["curator"]),
    );
    const useCase = new InviteUserUseCase(userRepository, new FakeOpaqueSecret());

    await assert.rejects(
      () => runWithActor(ADMIN_SCOPE, () => useCase.execute(InviteUserCommand.of("u2", "new@acme.com", "Y", ["curator"]))),
      /already in use/,
    );
  });

  it("fails when there is no tenant in the actor context", async () => {
    const useCase = new InviteUserUseCase(new FakeUserRepository(), new FakeOpaqueSecret());

    await assert.rejects(
      () => useCase.execute(InviteUserCommand.of("u2", "new@acme.com", "Y", ["curator"])),
      /without a tenant/,
    );
  });
});
