import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { IdentityModule, type IdentityModuleDeps } from "./IdentityModule.ts";
import { SESSION_COOKIE_NAME } from "../infrastructure/http/SessionCookie.ts";
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
  // Emit the body on next tick so the readJsonBody listeners are attached first.
  queueMicrotask(() => {
    if (options.body !== undefined) {
      emitter.emit("data", Buffer.from(JSON.stringify(options.body)));
    }
    emitter.emit("end");
  });
  return emitter;
}

function baseDeps(overrides: Partial<IdentityModuleDeps>): IdentityModuleDeps {
  const notUsed = { execute: async () => ({}) } as unknown as never;
  return {
    applicationService: { execute: async () => [] } as unknown as IdentityModuleDeps["applicationService"],
    sessionRepository: { revokeAllForUser: async () => {} } as unknown as IdentityModuleDeps["sessionRepository"],
    provisionOrganization: notUsed,
    authenticate: notUsed,
    resolveSession: { execute: async () => null } as unknown as IdentityModuleDeps["resolveSession"],
    inviteUser: notUsed,
    acceptInvitation: notUsed,
    changeUserRoles: notUsed,
    disableUser: notUsed,
    setOrganizationPolicy: notUsed,
    issueConsumerCredential: notUsed,
    rotateConsumerCredential: notUsed,
    revokeConsumerCredential: notUsed,
    listConsumerCredentials: notUsed,
    describeCurrentUser: notUsed,
    listOrgUsers: notUsed,
    readOrgPolicy: notUsed,
    operatorSecret: null,
    sessionTtlSeconds: 3600,
    cookieSecure: false,
    ...overrides,
  };
}

async function invoke(handler: RawRouteHandler, request: unknown, params: Record<string, string> = {}) {
  const response = new FakeResponse();
  handler(request as never, response as never, params);
  // allow the async handler chain (microtask body + awaits) to settle
  await new Promise((resolve) => setTimeout(resolve, 5));
  return response;
}

describe("IdentityModule routes", () => {
  let httpServer: FakeHttpServer;

  beforeEach(() => {
    httpServer = new FakeHttpServer();
  });

  it("registers the identity REST routes", () => {
    new IdentityModule(baseDeps({})).registerRoutes(httpServer as never);

    assert.ok(httpServer.routes.has("POST /auth/login"));
    assert.ok(httpServer.routes.has("POST /auth/logout"));
    assert.ok(httpServer.routes.has("GET /auth/me"));
    assert.ok(httpServer.routes.has("GET /organizations/:orgId/users"));
    assert.ok(httpServer.routes.has("GET /organizations/:orgId/policy"));
    assert.ok(httpServer.routes.has("POST /operator/organizations"));
    assert.ok(httpServer.routes.has("POST /invitations/:token/accept"));
    assert.ok(httpServer.routes.has("POST /organizations/:orgId/users/invite"));
    assert.ok(httpServer.routes.has("PUT /users/:userId/roles"));
    assert.ok(httpServer.routes.has("POST /users/:userId/disable"));
    assert.ok(httpServer.routes.has("PUT /organizations/:orgId/policy"));
    assert.ok(httpServer.routes.has("POST /credentials"));
    assert.ok(httpServer.routes.has("POST /credentials/:id/rotate"));
    assert.ok(httpServer.routes.has("DELETE /credentials/:id"));
    assert.ok(httpServer.routes.has("GET /credentials"));
  });

  it("logs in: returns 200 and sets an httpOnly session cookie", async () => {
    const authenticate = {
      execute: async () => ({
        token: "sess-token",
        userId: "u1",
        companyId: "c1",
        expiresAt: new Date("2026-06-16T13:00:00.000Z"),
      }),
    } as unknown as IdentityModuleDeps["authenticate"];
    // Login now runs through the UnitOfWork via applicationService.execute (so the session is
    // flushed, ADR-004); the stub delegates to the use case to keep the edge behaviour observable.
    const applicationService = {
      execute: async (useCase: { execute: (command: unknown) => Promise<unknown> }, command: unknown) =>
        useCase.execute(command),
    } as unknown as IdentityModuleDeps["applicationService"];
    new IdentityModule(baseDeps({ authenticate, applicationService })).registerRoutes(httpServer as never);

    const response = await invoke(
      httpServer.routes.get("POST /auth/login")!,
      fakeRequest({ body: { email: "a@b.com", password: "pw" } }),
    );

    assert.equal(response.statusCode, 200);
    assert.ok(response.headers["Set-Cookie"]?.startsWith(SESSION_COOKIE_NAME + "=sess-token"));
    assert.ok(response.headers["Set-Cookie"]?.includes("HttpOnly"));
  });

  it("rejects an authed route with no session cookie (401)", async () => {
    new IdentityModule(baseDeps({})).registerRoutes(httpServer as never);

    const response = await invoke(
      httpServer.routes.get("GET /credentials")!,
      fakeRequest({}),
    );

    assert.equal(response.statusCode, 401);
  });

  it("allows an authed route when the session resolves to a principal", async () => {
    const resolveSession = {
      execute: async () => ({ companyId: "c1", actorId: "u1", actorType: "user", roles: ["admin"] }),
    } as unknown as IdentityModuleDeps["resolveSession"];
    new IdentityModule(baseDeps({ resolveSession })).registerRoutes(httpServer as never);

    const response = await invoke(
      httpServer.routes.get("GET /credentials")!,
      fakeRequest({ cookie: SESSION_COOKIE_NAME + "=good" }),
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.payload), { credentials: [] });
  });
});
