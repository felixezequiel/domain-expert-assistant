import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { SessionResolverPort } from "./SessionResolverPort.ts";
import type { Actor } from "../context/ActorContext.ts";

// The port is a pure interface; this pins its contract — resolve maps a cookie header to an
// Actor (valid session) or null (no/expired session), the shape the shared edge depends on.
describe("SessionResolverPort", () => {
  const actor: Actor = { companyId: "co-1", actorId: "u-1", actorType: "user", roles: ["curator"] };
  const resolver: SessionResolverPort = {
    resolve: async (cookieHeader) => (cookieHeader === undefined ? null : actor),
  };

  it("resolves a present cookie header to an Actor", async () => {
    assert.deepEqual(await resolver.resolve("des_session=abc"), actor);
  });

  it("resolves to null when there is no cookie", async () => {
    assert.equal(await resolver.resolve(undefined), null);
  });
});
