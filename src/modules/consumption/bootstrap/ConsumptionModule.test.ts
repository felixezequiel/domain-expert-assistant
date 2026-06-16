import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { ConsumptionModule, type ConsumptionModuleDeps } from "./ConsumptionModule.ts";
import { ScopeViolationError } from "../application/errors.ts";
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
  public payload = "";
  public readonly headers: Record<string, string> = {};
  public setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }
  public writeHead(statusCode: number): void {
    this.statusCode = statusCode;
  }
  public end(body?: string): void {
    this.payload = body ?? "";
  }
}

function fakeRequest(options: { authorization?: string; url?: string }): EventEmitter & {
  headers: Record<string, string | undefined>;
  url: string;
  method: string;
} {
  const emitter = new EventEmitter() as EventEmitter & {
    headers: Record<string, string | undefined>;
    url: string;
    method: string;
  };
  emitter.headers = { authorization: options.authorization };
  emitter.url = options.url ?? "/v1/search?q=hello";
  emitter.method = "GET";
  return emitter;
}

const CREDENTIAL = {
  id: { value: "cred-1" },
  companyId: "company-1",
  scope: { collectionIds: ["col-a"], sensitivityCeiling: { name: "internal" } },
  isActive: () => true,
};

function deps(overrides: Partial<ConsumptionModuleDeps>): ConsumptionModuleDeps {
  const noopFacade = {
    search: async () => ({ results: [], effectiveScope: { collectionIds: ["col-a"], sensitivityCeiling: "internal" } }),
    lookup: async () => [],
    listCollections: async () => [],
    listTags: async () => [],
    getItem: async () => null,
  };
  return {
    applicationService: { execute: async () => undefined } as unknown as ConsumptionModuleDeps["applicationService"],
    authenticateConsumer: { execute: async () => CREDENTIAL } as unknown as ConsumptionModuleDeps["authenticateConsumer"],
    knowledgeQueryFacade: noopFacade as unknown as ConsumptionModuleDeps["knowledgeQueryFacade"],
    recordCredentialUsage: { execute: async () => undefined } as unknown as ConsumptionModuleDeps["recordCredentialUsage"],
    rateLimiter: { check: () => ({ allowed: true, retryAfterSeconds: 0 }) } as unknown as ConsumptionModuleDeps["rateLimiter"],
    logger: { info() {}, warn() {}, error() {}, debug() {} } as unknown as ConsumptionModuleDeps["logger"],
    ...overrides,
  };
}

async function invoke(handler: RawRouteHandler, request: unknown, params: Record<string, string> = {}) {
  const response = new FakeResponse();
  handler(request as never, response as never, params);
  await new Promise((resolve) => setTimeout(resolve, 25));
  return response;
}

describe("ConsumptionModule routes", () => {
  let httpServer: FakeHttpServer;
  beforeEach(() => {
    httpServer = new FakeHttpServer();
  });

  it("registers the REST and MCP routes", () => {
    new ConsumptionModule(deps({})).registerRoutes(httpServer as never);
    for (const route of ["GET /v1/search", "GET /v1/lookup", "GET /v1/collections", "GET /v1/tags", "GET /v1/items/:itemId"]) {
      assert.ok(httpServer.routes.has(route), "missing " + route);
    }
    assert.ok(httpServer.routes.has("POST /mcp"));
    assert.ok(httpServer.routes.has("GET /mcp"));
    assert.ok(httpServer.routes.has("DELETE /mcp"));
  });

  it("rejects a request with no Bearer header (401)", async () => {
    new ConsumptionModule(deps({})).registerRoutes(httpServer as never);
    const response = await invoke(httpServer.routes.get("GET /v1/search")!, fakeRequest({}));
    assert.equal(response.statusCode, 401);
  });

  it("rejects an invalid/revoked key (401)", async () => {
    const authenticateConsumer = { execute: async () => null } as unknown as ConsumptionModuleDeps["authenticateConsumer"];
    new ConsumptionModule(deps({ authenticateConsumer })).registerRoutes(httpServer as never);
    const response = await invoke(
      httpServer.routes.get("GET /v1/search")!,
      fakeRequest({ authorization: "Bearer bad-key" }),
    );
    assert.equal(response.statusCode, 401);
  });

  it("serves a search (200) for a valid key and echoes the effective scope", async () => {
    new ConsumptionModule(deps({})).registerRoutes(httpServer as never);
    const response = await invoke(
      httpServer.routes.get("GET /v1/search")!,
      fakeRequest({ authorization: "Bearer good-key", url: "/v1/search?q=hello" }),
    );
    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.deepEqual(body.effectiveScope, { collectionIds: ["col-a"], sensitivityCeiling: "internal" });
  });

  it("returns 429 when the rate limiter denies the credential", async () => {
    const rateLimiter = { check: () => ({ allowed: false, retryAfterSeconds: 30 }) } as unknown as ConsumptionModuleDeps["rateLimiter"];
    new ConsumptionModule(deps({ rateLimiter })).registerRoutes(httpServer as never);
    const response = await invoke(
      httpServer.routes.get("GET /v1/search")!,
      fakeRequest({ authorization: "Bearer good-key" }),
    );
    assert.equal(response.statusCode, 429);
    assert.equal(response.headers["Retry-After"], "30");
  });

  it("maps a ScopeViolationError to 403", async () => {
    const knowledgeQueryFacade = {
      search: async () => {
        throw new ScopeViolationError("col-forbidden");
      },
    } as unknown as ConsumptionModuleDeps["knowledgeQueryFacade"];
    new ConsumptionModule(deps({ knowledgeQueryFacade })).registerRoutes(httpServer as never);
    const response = await invoke(
      httpServer.routes.get("GET /v1/search")!,
      fakeRequest({ authorization: "Bearer good-key", url: "/v1/search?q=x&collection=col-forbidden" }),
    );
    assert.equal(response.statusCode, 403);
  });

  it("returns 404 for an out-of-scope / missing item", async () => {
    new ConsumptionModule(deps({})).registerRoutes(httpServer as never);
    const response = await invoke(
      httpServer.routes.get("GET /v1/items/:itemId")!,
      fakeRequest({ authorization: "Bearer good-key", url: "/v1/items/missing" }),
      { itemId: "missing" },
    );
    assert.equal(response.statusCode, 404);
  });
});
