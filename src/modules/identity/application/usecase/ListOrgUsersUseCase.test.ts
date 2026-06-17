import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ListOrgUsersUseCase } from "./ListOrgUsersUseCase.ts";
import { FakeUserRepository } from "../testDoubles/index.ts";
import { User } from "../../domain/aggregates/User.ts";
import { UserId } from "../../domain/identifiers/UserId.ts";
import { Email } from "../../domain/valueObjects/Email.ts";
import { DisplayName } from "../../domain/valueObjects/DisplayName.ts";
import { PasswordHash } from "../../domain/valueObjects/PasswordHash.ts";
import { runWithActor } from "../../../../shared/application/context/ActorContext.ts";

const ADMIN_SCOPE = {
  companyId: "company-1",
  actorId: "admin-1",
  actorType: "user" as const,
  roles: ["admin" as const],
};

function user(
  id: string,
  companyId: string,
  email: string,
  roles: ReadonlyArray<"admin" | "curator" | "reviewer" | "auditor" | "consumer">,
): User {
  return User.reconstitute(
    new UserId(id),
    companyId,
    new Email(email),
    new DisplayName("User " + id),
    new PasswordHash("h:pw"),
    roles,
    "active",
  );
}

describe("ListOrgUsersUseCase", () => {
  it("lists only the tenant's users with id, email, displayName, roles and status", async () => {
    const repo = new FakeUserRepository();
    await repo.save(user("u1", "company-1", "ada@acme.com", ["admin"]));
    await repo.save(user("u2", "company-1", "carl@acme.com", ["curator"]));
    await repo.save(user("u3", "company-OTHER", "intruder@acme.com", ["admin"]));
    const useCase = new ListOrgUsersUseCase(repo);

    const views = await runWithActor(ADMIN_SCOPE, () => useCase.execute());

    assert.deepEqual(
      views.map((view) => view.email).sort(),
      ["ada@acme.com", "carl@acme.com"],
    );
    const ada = views.find((view) => view.email === "ada@acme.com");
    assert.deepEqual(ada?.roles, ["admin"]);
    assert.equal(ada?.displayName, "User u1");
  });

  it("fails without a tenant in the context", async () => {
    const useCase = new ListOrgUsersUseCase(new FakeUserRepository());

    await assert.rejects(() => useCase.execute(), /without a tenant/);
  });
});
