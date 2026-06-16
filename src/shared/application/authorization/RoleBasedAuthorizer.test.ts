import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  RoleBasedAuthorizer,
  UnauthorizedError,
  isRoleRestricted,
} from "./RoleBasedAuthorizer.ts";
import { runWithActor } from "../context/ActorContext.ts";

describe("RoleBasedAuthorizer", () => {
  const authorizer = new RoleBasedAuthorizer();

  it("allows when no roles are required (open use case)", () => {
    assert.doesNotThrow(() => authorizer.authorize([]));
  });

  it("allows when the actor holds one of the required roles", async () => {
    await runWithActor(
      { companyId: "c1", actorId: "u1", actorType: "user", roles: ["admin", "curator"] },
      async () => assert.doesNotThrow(() => authorizer.authorize(["admin"])),
    );
  });

  it("denies when the actor lacks every required role", async () => {
    await runWithActor(
      { companyId: "c1", actorId: "u1", actorType: "user", roles: ["auditor"] },
      async () => assert.throws(() => authorizer.authorize(["admin"]), UnauthorizedError),
    );
  });

  it("denies when there is no actor at all", () => {
    assert.throws(() => authorizer.authorize(["admin"]), UnauthorizedError);
  });

  it("denies an actor with no roles (e.g. a consumer credential)", async () => {
    await runWithActor(
      { companyId: "c1", actorId: "cred-1", actorType: "consumer" },
      async () => assert.throws(() => authorizer.authorize(["admin"]), UnauthorizedError),
    );
  });
});

describe("isRoleRestricted", () => {
  it("is true for a use case declaring requiredRoles", () => {
    assert.equal(isRoleRestricted({ requiredRoles: ["admin"], execute: async () => null }), true);
  });

  it("is false for a use case without requiredRoles", () => {
    assert.equal(isRoleRestricted({ execute: async () => null }), false);
  });
});
