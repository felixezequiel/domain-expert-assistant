import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getCurrentActor,
  runWithActor,
  isPrivilegedActorType,
  isPrivilegedScope,
  type Actor,
} from "./ActorContext.ts";

describe("ActorContext", () => {
  it("returns null when there is no actor in scope", () => {
    assert.equal(getCurrentActor(), null);
  });

  it("exposes the actor inside runWithActor", async () => {
    const actor: Actor = { companyId: "company-1", actorId: "user-1", actorType: "user" };

    const captured = await runWithActor(actor, async () => getCurrentActor());

    assert.deepEqual(captured, actor);
  });

  it("restores the absence of actor after the scope ends", async () => {
    await runWithActor({ companyId: "c1", actorId: "u1", actorType: "user" }, async () => {
      assert.notEqual(getCurrentActor(), null);
    });

    assert.equal(getCurrentActor(), null);
  });

  it("isolates concurrent scopes", async () => {
    const results: Array<string | null> = [];

    await Promise.all([
      runWithActor({ companyId: "a", actorId: "u", actorType: "user" }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        results.push(getCurrentActor()?.companyId ?? null);
      }),
      runWithActor({ companyId: "b", actorId: "u", actorType: "user" }, async () => {
        results.push(getCurrentActor()?.companyId ?? null);
      }),
    ]);

    assert.ok(results.includes("a"));
    assert.ok(results.includes("b"));
  });

  it("nests scopes, the inner one shadowing the outer", async () => {
    let inner: string | null = null;
    let afterInner: string | null = null;

    await runWithActor({ companyId: "outer", actorId: "u", actorType: "user" }, async () => {
      await runWithActor({ companyId: "inner", actorId: "u", actorType: "operator" }, async () => {
        inner = getCurrentActor()?.companyId ?? null;
      });
      afterInner = getCurrentActor()?.companyId ?? null;
    });

    assert.equal(inner, "inner");
    assert.equal(afterInner, "outer");
  });

  describe("isPrivilegedActorType", () => {
    it("treats system and operator as privileged", () => {
      assert.equal(isPrivilegedActorType("system"), true);
      assert.equal(isPrivilegedActorType("operator"), true);
    });

    it("treats user and consumer as non-privileged", () => {
      assert.equal(isPrivilegedActorType("user"), false);
      assert.equal(isPrivilegedActorType("consumer"), false);
    });

    it("treats a null actorType as non-privileged", () => {
      assert.equal(isPrivilegedActorType(null), false);
    });
  });

  describe("isPrivilegedScope", () => {
    it("is false with no actor", () => {
      assert.equal(isPrivilegedScope(), false);
    });

    it("is true inside an operator scope", async () => {
      const result = await runWithActor(
        { companyId: null, actorId: "op-1", actorType: "operator" },
        async () => isPrivilegedScope(),
      );

      assert.equal(result, true);
    });

    it("is false inside a tenant user scope", async () => {
      const result = await runWithActor(
        { companyId: "c1", actorId: "u1", actorType: "user" },
        async () => isPrivilegedScope(),
      );

      assert.equal(result, false);
    });
  });
});
