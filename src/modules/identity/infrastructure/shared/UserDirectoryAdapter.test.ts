import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UserDirectoryAdapter } from "./UserDirectoryAdapter.ts";
import { FakeUserRepository } from "../../application/testDoubles/index.ts";
import { User } from "../../domain/aggregates/User.ts";
import { UserId } from "../../domain/identifiers/UserId.ts";
import { Email } from "../../domain/valueObjects/Email.ts";
import { DisplayName } from "../../domain/valueObjects/DisplayName.ts";
import { runWithActor } from "../../../../shared/application/context/ActorContext.ts";

const COMPANY = "company-1";

function activeUser(id: string, displayName: string, companyId = COMPANY): User {
  return User.reconstitute(
    new UserId(id),
    companyId,
    new Email(id + "@example.test"),
    new DisplayName(displayName),
    null,
    ["curator"],
    "active",
  );
}

const TENANT_ACTOR = { companyId: COMPANY, actorId: "u", actorType: "user" as const };

describe("UserDirectoryAdapter", () => {
  it("resolves the display names of users in the caller's tenant", async () => {
    const repository = new FakeUserRepository();
    await repository.save(activeUser("user-1", "Ada Lovelace"));
    await repository.save(activeUser("user-2", "Carl Curator"));
    const adapter = new UserDirectoryAdapter(repository);

    const names = await runWithActor(TENANT_ACTOR, () =>
      adapter.resolveDisplayNames(["user-1", "user-2"]),
    );

    assert.equal(names.get("user-1"), "Ada Lovelace");
    assert.equal(names.get("user-2"), "Carl Curator");
  });

  it("omits ids it cannot resolve (unknown or another tenant), so the caller falls back", async () => {
    const repository = new FakeUserRepository();
    await repository.save(activeUser("user-1", "Ada Lovelace"));
    await repository.save(activeUser("user-x", "Other Org", "company-2"));
    const adapter = new UserDirectoryAdapter(repository);

    const names = await runWithActor(TENANT_ACTOR, () =>
      adapter.resolveDisplayNames(["user-1", "user-x", "user-missing"]),
    );

    assert.deepEqual([...names.keys()], ["user-1"]);
  });

  it("resolves nothing when there is no tenant in scope (privileged/system reads)", async () => {
    const repository = new FakeUserRepository();
    await repository.save(activeUser("user-1", "Ada Lovelace"));
    const adapter = new UserDirectoryAdapter(repository);

    const names = await runWithActor(
      { companyId: null, actorId: "op", actorType: "operator" },
      () => adapter.resolveDisplayNames(["user-1"]),
    );

    assert.equal(names.size, 0);
  });
});
