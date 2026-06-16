import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { RetrievalModule, type RetrievalModuleDeps } from "./RetrievalModule.ts";
import { SESSION_COOKIE_NAME } from "../../identity/infrastructure/http/SessionCookie.ts";
import type { RawRouteHandler } from "../../../shared/infrastructure/http/HttpServer.ts";

class FakeHttpServer {
  public readonly routes = new Map<string, RawRouteHandler>();
  public rawGet(path: string, handler: RawRouteHandler): void {
    this.routes.set("GET " + path, handler);
  }
  public rawPost(path: string, handler: RawRouteHandler): void {
    this.routes.set("POST " + path, handler);
  }
}

class FakeResponse {
  public statusCode = 0;
  public payload = "";
  public writeHead(statusCode: number): void {
    this.statusCode = statusCode;
  }
  public end(body?: string): void {
    this.payload = body ?? "";
  }
}

function fakeRequest(options: { cookie?: string; body?: unknown }): EventEmitter & {
  headers: Record<string, string | undefined>;
} {
  const emitter = new EventEmitter() as EventEmitter & { headers: Record<string, string | undefined> };
  emitter.headers = { cookie: options.cookie };
  setTimeout(() => {
    if (options.body !== undefined) {
      emitter.emit("data", Buffer.from(JSON.stringify(options.body)));
    }
    emitter.emit("end");
  }, 0);
  return emitter;
}

function deps(overrides: Partial<RetrievalModuleDeps>): RetrievalModuleDeps {
  const notUsed = { execute: async () => [] } as unknown as never;
  return {
    applicationService: {
      execute: async (useCase: { execute: (command: unknown) => Promise<unknown> }, command: unknown) =>
        useCase.execute(command),
    } as unknown as RetrievalModuleDeps["applicationService"],
    resolveSession: { execute: async () => null } as unknown as RetrievalModuleDeps["resolveSession"],
    semanticSearch: notUsed,
    rebuildIndex: notUsed,
    ...overrides,
  };
}

function principal(roles: ReadonlyArray<string>) {
  return {
    execute: async () => ({ companyId: "c1", actorId: "u1", actorType: "user", roles }),
  } as unknown as RetrievalModuleDeps["resolveSession"];
}

async function invoke(handler: RawRouteHandler, request: unknown, params: Record<string, string> = {}) {
  const response = new FakeResponse();
  handler(request as never, response as never, params);
  await new Promise((resolve) => setTimeout(resolve, 25));
  return response;
}

describe("RetrievalModule routes", () => {
  let httpServer: FakeHttpServer;
  beforeEach(() => {
    httpServer = new FakeHttpServer();
  });

  it("registers the search and rebuild routes", () => {
    new RetrievalModule(deps({})).registerRoutes(httpServer as never);
    assert.ok(httpServer.routes.has("POST /search"));
    assert.ok(httpServer.routes.has("POST /index/rebuild"));
  });

  it("rejects search with no session (401)", async () => {
    new RetrievalModule(deps({})).registerRoutes(httpServer as never);
    const response = await invoke(
      httpServer.routes.get("POST /search")!,
      fakeRequest({ body: { query: "refund" } }),
    );
    assert.equal(response.statusCode, 401);
  });

  it("returns ranked results for an authenticated search", async () => {
    const semanticSearch = {
      execute: async () => [
        {
          itemId: "item-1",
          title: "Refund policy",
          collectionId: "col-1",
          sensitivity: "internal",
          chunkIndex: 0,
          content: "refund within 30 days",
          score: 0.03,
          publishedAt: "2026-06-16T00:00:00.000Z",
          stale: false,
        },
      ],
    } as unknown as RetrievalModuleDeps["semanticSearch"];
    new RetrievalModule(deps({ resolveSession: principal(["curator"]), semanticSearch })).registerRoutes(
      httpServer as never,
    );

    const response = await invoke(
      httpServer.routes.get("POST /search")!,
      fakeRequest({ cookie: SESSION_COOKIE_NAME + "=good", body: { query: "refund" } }),
    );

    assert.equal(response.statusCode, 200);
    const payload = JSON.parse(response.payload) as { results: ReadonlyArray<{ itemId: string }> };
    assert.equal(payload.results[0]!.itemId, "item-1");
  });

  it("rejects search with a missing query (400)", async () => {
    new RetrievalModule(deps({ resolveSession: principal(["curator"]) })).registerRoutes(httpServer as never);
    const response = await invoke(
      httpServer.routes.get("POST /search")!,
      fakeRequest({ cookie: SESSION_COOKIE_NAME + "=good", body: {} }),
    );
    assert.equal(response.statusCode, 400);
  });

  it("forbids rebuild for a non-admin (403)", async () => {
    new RetrievalModule(deps({ resolveSession: principal(["curator"]) })).registerRoutes(httpServer as never);
    const response = await invoke(
      httpServer.routes.get("POST /index/rebuild")!,
      fakeRequest({ cookie: SESSION_COOKIE_NAME + "=good", body: {} }),
    );
    assert.equal(response.statusCode, 403);
  });

  it("allows rebuild for an admin (200)", async () => {
    const rebuildIndex = { execute: async () => 3 } as unknown as RetrievalModuleDeps["rebuildIndex"];
    new RetrievalModule(deps({ resolveSession: principal(["admin"]), rebuildIndex })).registerRoutes(
      httpServer as never,
    );
    const response = await invoke(
      httpServer.routes.get("POST /index/rebuild")!,
      fakeRequest({ cookie: SESSION_COOKIE_NAME + "=good", body: {} }),
    );
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.payload), { reprojected: 3 });
  });
});
