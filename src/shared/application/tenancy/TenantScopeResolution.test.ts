import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveTenantScope, MissingTenantContextError } from "./TenantScopeResolution.ts";
import type { Actor } from "../context/ActorContext.ts";

describe("resolveTenantScope", () => {
  it("returns a filtered scope for a tenant-bound user actor", () => {
    const actor: Actor = { companyId: "company-1", actorId: "user-1", actorType: "user" };

    const decision = resolveTenantScope(actor);

    assert.equal(decision.kind, "filtered");
    assert.equal(decision.kind === "filtered" ? decision.companyId : null, "company-1");
  });

  it("returns a filtered scope for a consumer actor", () => {
    const actor: Actor = { companyId: "company-1", actorId: "cred-1", actorType: "consumer" };

    const decision = resolveTenantScope(actor);

    assert.equal(decision.kind, "filtered");
  });

  it("returns a privileged scope for an operator (even without a tenant)", () => {
    const actor: Actor = { companyId: null, actorId: "op-1", actorType: "operator" };

    const decision = resolveTenantScope(actor);

    assert.equal(decision.kind, "privileged");
  });

  it("returns a privileged scope for a system actor", () => {
    const actor: Actor = { companyId: null, actorId: null, actorType: "system" };

    assert.equal(resolveTenantScope(actor).kind, "privileged");
  });

  it("prefers privileged over filtering when a privileged actor also carries a tenant", () => {
    const actor: Actor = { companyId: "company-1", actorId: "op-1", actorType: "operator" };

    assert.equal(resolveTenantScope(actor).kind, "privileged");
  });

  it("throws fail-closed when there is no actor at all", () => {
    assert.throws(() => resolveTenantScope(null), MissingTenantContextError);
  });

  it("throws fail-closed for a non-privileged actor without a tenant", () => {
    const actor: Actor = { companyId: null, actorId: "u1", actorType: "user" };

    assert.throws(() => resolveTenantScope(actor), MissingTenantContextError);
  });

  it("throws fail-closed for a bare scope with neither tenant nor type", () => {
    const actor: Actor = { companyId: null, actorId: null, actorType: null };

    assert.throws(() => resolveTenantScope(actor), MissingTenantContextError);
  });
});
