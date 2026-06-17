import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { AuditModule, type AuditModuleDeps } from "./AuditModule.ts";
import { SESSION_COOKIE_NAME } from "../../identity/infrastructure/http/SessionCookie.ts";
import type { RawRouteHandler } from "../../../shared/infrastructure/http/HttpServer.ts";
import { UnauthorizedError } from "../../../shared/application/authorization/RoleBasedAuthorizer.ts";

class FakeHttpServer {
  public readonly routes = new Map<string, RawRouteHandler>();
  public rawGet(path: string, handler: RawRouteHandler): void {
    this.routes.set("GET " + path, handler);
  }
  public rawPost(): void {}
  public rawPut(): void {}
  public rawDelete(): void {}
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

function fakeRequest(options: { cookie?: string; url?: string }): EventEmitter & {
  headers: Record<string, string | undefined>;
  url: string;
} {
  const emitter = new EventEmitter() as EventEmitter & {
    headers: Record<string, string | undefined>;
    url: string;
  };
  emitter.headers = { cookie: options.cookie };
  emitter.url = options.url ?? "/audit/events";
  return emitter;
}

function deps(overrides: Partial<AuditModuleDeps>): AuditModuleDeps {
  return {
    applicationService: {
      execute: async () => [{ eventId: "e1", eventName: "X", aggregateId: "a1" }],
    } as unknown as AuditModuleDeps["applicationService"],
    resolveSession: {
      execute: async () => ({ companyId: "c1", actorId: "u1", actorType: "user", roles: ["auditor"] }),
    } as unknown as AuditModuleDeps["resolveSession"],
    listAuditTrail: { execute: async () => [] } as unknown as AuditModuleDeps["listAuditTrail"],
    ...overrides,
  };
}

async function invoke(handler: RawRouteHandler, request: unknown) {
  const response = new FakeResponse();
  handler(request as never, response as never, {});
  await new Promise((resolve) => setTimeout(resolve, 25));
  return response;
}

describe("AuditModule routes", () => {
  let httpServer: FakeHttpServer;
  beforeEach(() => {
    httpServer = new FakeHttpServer();
  });

  it("registers the audit trail route", () => {
    new AuditModule(deps({})).registerRoutes(httpServer as never);
    assert.ok(httpServer.routes.has("GET /audit/events"));
  });

  it("rejects an unauthenticated request (401)", async () => {
    new AuditModule(deps({})).registerRoutes(httpServer as never);
    const response = await invoke(httpServer.routes.get("GET /audit/events")!, fakeRequest({}));
    assert.equal(response.statusCode, 401);
    assert.equal(JSON.parse(response.payload).error, "common.unauthorized");
  });

  it("returns the trail for an authenticated auditor (200)", async () => {
    new AuditModule(deps({})).registerRoutes(httpServer as never);
    const response = await invoke(
      httpServer.routes.get("GET /audit/events")!,
      fakeRequest({ cookie: SESSION_COOKIE_NAME + "=good", url: "/audit/events?eventName=X&limit=5" }),
    );
    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.equal(body.events[0].eventId, "e1");
  });

  it("maps a use-case authorization error to 403", async () => {
    const applicationService = {
      execute: async () => {
        throw new UnauthorizedError(["auditor", "admin"]);
      },
    } as unknown as AuditModuleDeps["applicationService"];
    new AuditModule(deps({ applicationService })).registerRoutes(httpServer as never);
    const response = await invoke(
      httpServer.routes.get("GET /audit/events")!,
      fakeRequest({ cookie: SESSION_COOKIE_NAME + "=good" }),
    );
    assert.equal(response.statusCode, 403);
    assert.equal(JSON.parse(response.payload).error, "common.forbiddenRole");
  });
});
