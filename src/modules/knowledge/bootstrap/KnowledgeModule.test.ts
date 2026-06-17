import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { KnowledgeModule, type KnowledgeModuleDeps } from "./KnowledgeModule.ts";
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
  public rawPut(path: string, handler: RawRouteHandler): void {
    this.routes.set("PUT " + path, handler);
  }
  public rawDelete(path: string, handler: RawRouteHandler): void {
    this.routes.set("DELETE " + path, handler);
  }
}

class FakeResponse {
  public statusCode = 0;
  public headers: Record<string, string> = {};
  public payload = "";
  public writeHead(statusCode: number, headers: Record<string, string>): void {
    this.statusCode = statusCode;
    this.headers = headers;
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
  queueMicrotask(() => {
    if (options.body !== undefined) {
      emitter.emit("data", Buffer.from(JSON.stringify(options.body)));
    }
    emitter.emit("end");
  });
  return emitter;
}

function baseDeps(overrides: Partial<KnowledgeModuleDeps>): KnowledgeModuleDeps {
  const notUsed = { execute: async () => ({}) } as unknown as never;
  return {
    applicationService: { execute: async () => [] } as unknown as KnowledgeModuleDeps["applicationService"],
    sessionResolver: { resolve: async () => null } as KnowledgeModuleDeps["sessionResolver"],
    createKnowledgeItem: notUsed,
    editKnowledgeItem: notUsed,
    submitForReview: notUsed,
    approveItem: notUsed,
    rejectItem: notUsed,
    deprecateItem: notUsed,
    archiveItem: notUsed,
    rollbackToVersion: notUsed,
    retagItem: notUsed,
    moveItemToCollection: notUsed,
    createCollection: notUsed,
    renameCollection: notUsed,
    createTenantTag: notUsed,
    removeTenantTag: notUsed,
    getKnowledgeItem: notUsed,
    listKnowledgeItems: notUsed,
    getVersionHistory: notUsed,
    listCollections: notUsed,
    listTags: notUsed,
    ...overrides,
  };
}

async function invoke(handler: RawRouteHandler, request: unknown, params: Record<string, string> = {}) {
  const response = new FakeResponse();
  handler(request as never, response as never, params);
  await new Promise((resolve) => setTimeout(resolve, 5));
  return response;
}

describe("KnowledgeModule routes", () => {
  let httpServer: FakeHttpServer;

  beforeEach(() => {
    httpServer = new FakeHttpServer();
  });

  it("registers the knowledge curation REST routes", () => {
    new KnowledgeModule(baseDeps({})).registerRoutes(httpServer as never);

    assert.ok(httpServer.routes.has("POST /items"));
    assert.ok(httpServer.routes.has("PUT /items/:id"));
    assert.ok(httpServer.routes.has("POST /items/:id/submit"));
    assert.ok(httpServer.routes.has("POST /items/:id/approve"));
    assert.ok(httpServer.routes.has("POST /items/:id/reject"));
    assert.ok(httpServer.routes.has("POST /items/:id/deprecate"));
    assert.ok(httpServer.routes.has("POST /items/:id/archive"));
    assert.ok(httpServer.routes.has("POST /items/:id/rollback"));
    assert.ok(httpServer.routes.has("POST /items/:id/retag"));
    assert.ok(httpServer.routes.has("POST /items/:id/move"));
    assert.ok(httpServer.routes.has("GET /items"));
    assert.ok(httpServer.routes.has("GET /items/:id"));
    assert.ok(httpServer.routes.has("GET /items/:id/versions"));
    assert.ok(httpServer.routes.has("POST /collections"));
    assert.ok(httpServer.routes.has("PUT /collections/:id"));
    assert.ok(httpServer.routes.has("GET /collections"));
    assert.ok(httpServer.routes.has("POST /tags"));
    assert.ok(httpServer.routes.has("DELETE /tags/:id"));
    assert.ok(httpServer.routes.has("GET /tags"));
  });

  it("rejects an authed route with no session cookie (401)", async () => {
    new KnowledgeModule(baseDeps({})).registerRoutes(httpServer as never);

    const response = await invoke(httpServer.routes.get("GET /tags")!, fakeRequest({}));

    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.payload), { error: "common.unauthorized", message: "Unauthorized" });
  });

  it("serializes a domain error as a coded body, preserving its status", async () => {
    const sessionResolver = {
      resolve: async () => ({ companyId: "c1", actorId: "u1", actorType: "user", roles: ["curator"] }),
    } as unknown as KnowledgeModuleDeps["sessionResolver"];
    const applicationService = {
      execute: async () => null,
    } as unknown as KnowledgeModuleDeps["applicationService"];

    new KnowledgeModule(baseDeps({ sessionResolver, applicationService })).registerRoutes(httpServer as never);

    const response = await invoke(
      httpServer.routes.get("GET /items/:id")!,
      fakeRequest({ cookie: SESSION_COOKIE_NAME + "=good" }),
      { id: "missing" },
    );

    assert.equal(response.statusCode, 400);
    assert.deepEqual(JSON.parse(response.payload), {
      error: "knowledge.itemNotFound",
      message: "Knowledge item not found: missing",
      params: { id: "missing" },
    });
  });

  it("allows an authed route when the session resolves to a principal", async () => {
    const sessionResolver = {
      resolve: async () => ({ companyId: "c1", actorId: "u1", actorType: "user", roles: ["admin"] }),
    } as unknown as KnowledgeModuleDeps["sessionResolver"];
    const listTags = {
      execute: async () => [{ id: "t1", slug: "system:pricing", label: "Pricing", scope: "system" }],
    } as unknown as KnowledgeModuleDeps["listTags"];
    const applicationService = {
      execute: async (useCase: { execute: (input: unknown) => Promise<unknown> }, input: unknown) =>
        useCase.execute(input),
    } as unknown as KnowledgeModuleDeps["applicationService"];

    new KnowledgeModule(baseDeps({ sessionResolver, listTags, applicationService })).registerRoutes(
      httpServer as never,
    );

    const response = await invoke(
      httpServer.routes.get("GET /tags")!,
      fakeRequest({ cookie: SESSION_COOKIE_NAME + "=good" }),
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.payload), {
      tags: [{ id: "t1", slug: "system:pricing", label: "Pricing", scope: "system" }],
    });
  });
});
