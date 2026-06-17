import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { runAuthenticatedRoute, runPublicRoute, type RouteResult } from "./authenticatedRoute.ts";
import { getCurrentActor, type Actor } from "../../application/context/ActorContext.ts";
import { DomainError } from "../../domain/errors/DomainError.ts";
import type { SessionResolverPort } from "../../application/ports/SessionResolverPort.ts";

interface Captured {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}

function fakeResponse(): { response: ServerResponse; captured: Captured } {
  const captured: Captured = { statusCode: 0, headers: {}, body: undefined };
  const response = {
    writeHead(statusCode: number, headers: Record<string, string>): ServerResponse {
      captured.statusCode = statusCode;
      captured.headers = headers;
      return response;
    },
    end(data?: string): void {
      captured.body = data === undefined ? undefined : JSON.parse(data);
    },
  } as unknown as ServerResponse;
  return { response, captured };
}

function fakeRequest(cookie: string | undefined): IncomingMessage {
  return { headers: { cookie } } as unknown as IncomingMessage;
}

const ACTOR: Actor = { companyId: "co-1", actorId: "user-1", actorType: "user", roles: ["curator"] };
const resolverFor = (actor: Actor | null): SessionResolverPort => ({
  resolve: async () => actor,
});

describe("authenticatedRoute", () => {
  it("resolves the principal, opens the ActorContext, and serializes the result", async () => {
    const { response, captured } = fakeResponse();
    let seenActor: Actor | null = null;
    await runAuthenticatedRoute(
      resolverFor(ACTOR),
      async () => {
        seenActor = getCurrentActor();
        return { statusCode: 200, body: { ok: true } } satisfies RouteResult;
      },
      fakeRequest("des_session=abc"),
      response,
      {},
    );
    assert.deepEqual(seenActor, ACTOR);
    assert.equal(captured.statusCode, 200);
    assert.deepEqual(captured.body, { ok: true });
    assert.equal(captured.headers["Content-Type"], "application/json");
  });

  it("returns a coded 401 when there is no valid session, without running the handler", async () => {
    const { response, captured } = fakeResponse();
    let ran = false;
    await runAuthenticatedRoute(
      resolverFor(null),
      async () => {
        ran = true;
        return { statusCode: 200, body: {} };
      },
      fakeRequest(undefined),
      response,
      {},
    );
    assert.equal(ran, false);
    assert.equal(captured.statusCode, 401);
    assert.deepEqual(captured.body, { error: "common.unauthorized", message: "Unauthorized" });
  });

  it("serializes a thrown DomainError to its coded shape and status", async () => {
    const { response, captured } = fakeResponse();
    await runAuthenticatedRoute(
      resolverFor(ACTOR),
      async () => {
        throw new DomainError("knowledge.itemNotFound", "not_found", { id: "x" }, "Knowledge item not found: x");
      },
      fakeRequest("des_session=abc"),
      response,
      {},
    );
    assert.equal(captured.statusCode, 404);
    assert.deepEqual(captured.body, {
      error: "knowledge.itemNotFound",
      message: "Knowledge item not found: x",
      params: { id: "x" },
    });
  });

  it("passes the handler's headers through (e.g. Set-Cookie)", async () => {
    const { response, captured } = fakeResponse();
    await runAuthenticatedRoute(
      resolverFor(ACTOR),
      async () => ({ statusCode: 200, body: {}, headers: { "Set-Cookie": "des_session=; Max-Age=0" } }),
      fakeRequest("des_session=abc"),
      response,
      {},
    );
    assert.equal(captured.headers["Set-Cookie"], "des_session=; Max-Age=0");
    assert.equal(captured.headers["Content-Type"], "application/json");
  });
});

describe("publicRoute (runPublicRoute)", () => {
  it("serializes the handler result without resolving a session", async () => {
    const { response, captured } = fakeResponse();
    await runPublicRoute(
      async () => ({ statusCode: 201, body: { id: "x" }, headers: { "Set-Cookie": "des_session=t" } }),
      fakeRequest(undefined),
      response,
      {},
    );
    assert.equal(captured.statusCode, 201);
    assert.deepEqual(captured.body, { id: "x" });
    assert.equal(captured.headers["Set-Cookie"], "des_session=t");
  });

  it("serializes a thrown DomainError to its coded shape", async () => {
    const { response, captured } = fakeResponse();
    await runPublicRoute(
      async () => {
        throw new DomainError("identity.invalidCredentials", "unauthorized", undefined, "Invalid credentials");
      },
      fakeRequest(undefined),
      response,
      {},
    );
    assert.equal(captured.statusCode, 401);
    assert.deepEqual(captured.body, { error: "identity.invalidCredentials", message: "Invalid credentials" });
  });
});
