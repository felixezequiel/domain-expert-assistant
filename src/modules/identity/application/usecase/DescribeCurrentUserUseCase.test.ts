import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DescribeCurrentUserUseCase } from "./DescribeCurrentUserUseCase.ts";
import { FakeUserRepository } from "../testDoubles/index.ts";
import { User } from "../../domain/aggregates/User.ts";
import { UserId } from "../../domain/identifiers/UserId.ts";
import { Email } from "../../domain/valueObjects/Email.ts";
import { DisplayName } from "../../domain/valueObjects/DisplayName.ts";
import { PasswordHash } from "../../domain/valueObjects/PasswordHash.ts";
import { runWithActor } from "../../../../shared/application/context/ActorContext.ts";

function activeUser(
  id: string,
  companyId: string,
  email: string,
  name: string,
  roles: ReadonlyArray<"admin" | "curator" | "reviewer" | "auditor" | "consumer">,
): User {
  return User.reconstitute(
    new UserId(id),
    companyId,
    new Email(email),
    new DisplayName(name),
    new PasswordHash("h:pw"),
    roles,
    "active",
  );
}

describe("DescribeCurrentUserUseCase", () => {
  it("returns the current user's id, name, email, roles and status", async () => {
    const repo = new FakeUserRepository();
    await repo.save(activeUser("u1", "company-1", "ada@acme.com", "Ada Admin", ["admin", "curator"]));
    const useCase = new DescribeCurrentUserUseCase(repo);

    const view = await runWithActor(
      { companyId: "company-1", actorId: "u1", actorType: "user", roles: ["admin"] },
      () => useCase.execute(),
    );

    assert.equal(view.userId, "u1");
    assert.equal(view.email, "ada@acme.com");
    assert.equal(view.displayName, "Ada Admin");
    assert.deepEqual([...view.roles].sort(), ["admin", "curator"]);
    assert.equal(view.status, "active");
  });

  it("fails without an actor in the context", async () => {
    const useCase = new DescribeCurrentUserUseCase(new FakeUserRepository());

    await assert.rejects(() => useCase.execute(), /without an actor/);
  });
});
