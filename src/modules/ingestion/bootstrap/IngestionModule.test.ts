import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { IngestionModule, type IngestionModuleDeps } from "./IngestionModule.ts";
import { SESSION_COOKIE_NAME } from "../../identity/infrastructure/http/SessionCookie.ts";
import type { RawRouteHandler } from "../../../shared/infrastructure/http/HttpServer.ts";
import { DomainError } from "../../../shared/domain/errors/DomainError.ts";

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
  // Emit on a macrotask so the body listeners (registered after the async auth hop) are ready.
  setTimeout(() => {
    if (options.body !== undefined) {
      emitter.emit("data", Buffer.from(JSON.stringify(options.body)));
    }
    emitter.emit("end");
  }, 0);
  return emitter;
}

function deps(overrides: Partial<IngestionModuleDeps>): IngestionModuleDeps {
  const notUsed = { execute: async () => null } as unknown as never;
  return {
    applicationService: { execute: async () => ({ id: { value: "job-1" }, status: "pending" }) } as unknown as IngestionModuleDeps["applicationService"],
    resolveSession: { execute: async () => null } as unknown as IngestionModuleDeps["resolveSession"],
    uploadDocument: notUsed,
    getIngestionJob: notUsed,
    ...overrides,
  };
}

async function invoke(handler: RawRouteHandler, request: unknown, params: Record<string, string> = {}) {
  const response = new FakeResponse();
  handler(request as never, response as never, params);
  await new Promise((resolve) => setTimeout(resolve, 25));
  return response;
}

describe("IngestionModule routes", () => {
  let httpServer: FakeHttpServer;
  beforeEach(() => {
    httpServer = new FakeHttpServer();
  });

  it("registers the ingestion routes", () => {
    new IngestionModule(deps({})).registerRoutes(httpServer as never);
    assert.ok(httpServer.routes.has("POST /ingestion/uploads"));
    assert.ok(httpServer.routes.has("GET /ingestion/jobs/:id"));
  });

  it("rejects upload with no session cookie (401) with a coded body", async () => {
    new IngestionModule(deps({})).registerRoutes(httpServer as never);
    const response = await invoke(
      httpServer.routes.get("POST /ingestion/uploads")!,
      fakeRequest({ body: { collectionId: "c", filename: "f", mimeType: "text/markdown", contentBase64: "aGk=" } }),
    );
    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.payload), { error: "common.unauthorized", message: "Unauthorized" });
  });

  it("accepts an upload (202) when the session resolves", async () => {
    const resolveSession = {
      execute: async () => ({ companyId: "c1", actorId: "u1", actorType: "user", roles: ["curator"] }),
    } as unknown as IngestionModuleDeps["resolveSession"];
    new IngestionModule(deps({ resolveSession })).registerRoutes(httpServer as never);

    const response = await invoke(
      httpServer.routes.get("POST /ingestion/uploads")!,
      fakeRequest({
        cookie: SESSION_COOKIE_NAME + "=good",
        body: { collectionId: "c", filename: "f.md", mimeType: "text/markdown", contentBase64: "aGk=" },
      }),
    );

    assert.equal(response.statusCode, 202);
    assert.deepEqual(JSON.parse(response.payload), { jobId: "job-1", status: "pending" });
  });

  it("maps an authorization failure (forbidden) to 403 with a coded body", async () => {
    const resolveSession = {
      execute: async () => ({ companyId: "c1", actorId: "u1", actorType: "user", roles: ["reviewer"] }),
    } as unknown as IngestionModuleDeps["resolveSession"];
    const applicationService = {
      execute: async () => {
        throw new DomainError(
          "common.forbiddenRole",
          "forbidden",
          { roles: "curator" },
          "Forbidden: requires one of the roles [curator].",
        );
      },
    } as unknown as IngestionModuleDeps["applicationService"];
    new IngestionModule(deps({ resolveSession, applicationService })).registerRoutes(httpServer as never);

    const response = await invoke(
      httpServer.routes.get("POST /ingestion/uploads")!,
      fakeRequest({
        cookie: SESSION_COOKIE_NAME + "=good",
        body: { collectionId: "c", filename: "f.md", mimeType: "text/markdown", contentBase64: "aGk=" },
      }),
    );

    assert.equal(response.statusCode, 403);
    assert.equal(JSON.parse(response.payload).error, "common.forbiddenRole");
    assert.equal(JSON.parse(response.payload).message, "Forbidden: requires one of the roles [curator].");
  });

  it("maps an oversize-upload rejection to 400 with a coded body", async () => {
    const resolveSession = {
      execute: async () => ({ companyId: "c1", actorId: "u1", actorType: "user", roles: ["curator"] }),
    } as unknown as IngestionModuleDeps["resolveSession"];
    const applicationService = {
      execute: async () => {
        throw new DomainError(
          "ingestion.contentTooLarge",
          "validation",
          { size: 11, maxBytes: 4 },
          "Document content is too large: 11 bytes exceeds the limit of 4 bytes",
        );
      },
    } as unknown as IngestionModuleDeps["applicationService"];
    new IngestionModule(deps({ resolveSession, applicationService })).registerRoutes(httpServer as never);

    const response = await invoke(
      httpServer.routes.get("POST /ingestion/uploads")!,
      fakeRequest({
        cookie: SESSION_COOKIE_NAME + "=good",
        body: { collectionId: "c", filename: "f.md", mimeType: "text/markdown", contentBase64: "aGVsbG8gd29ybGQ=" },
      }),
    );

    assert.equal(response.statusCode, 400);
    assert.equal(JSON.parse(response.payload).error, "ingestion.contentTooLarge");
    assert.deepEqual(JSON.parse(response.payload).params, { size: 11, maxBytes: 4 });
  });

  it("maps a missing required field to 400 with the shared fieldRequired code", async () => {
    const resolveSession = {
      execute: async () => ({ companyId: "c1", actorId: "u1", actorType: "user", roles: ["curator"] }),
    } as unknown as IngestionModuleDeps["resolveSession"];
    new IngestionModule(deps({ resolveSession })).registerRoutes(httpServer as never);

    const response = await invoke(
      httpServer.routes.get("POST /ingestion/uploads")!,
      fakeRequest({
        cookie: SESSION_COOKIE_NAME + "=good",
        body: { filename: "f.md", mimeType: "text/markdown", contentBase64: "aGk=" },
      }),
    );

    assert.equal(response.statusCode, 400);
    assert.equal(JSON.parse(response.payload).error, "common.fieldRequired");
    assert.deepEqual(JSON.parse(response.payload).params, { field: "collectionId" });
  });

  it("maps a missing job to 404 with a coded body", async () => {
    const resolveSession = {
      execute: async () => ({ companyId: "c1", actorId: "u1", actorType: "user", roles: ["curator"] }),
    } as unknown as IngestionModuleDeps["resolveSession"];
    const applicationService = { execute: async () => null } as unknown as IngestionModuleDeps["applicationService"];
    new IngestionModule(deps({ resolveSession, applicationService })).registerRoutes(httpServer as never);

    const response = await invoke(httpServer.routes.get("GET /ingestion/jobs/:id")!, fakeRequest({ cookie: SESSION_COOKIE_NAME + "=good" }), {
      id: "missing",
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(JSON.parse(response.payload), { error: "ingestion.jobNotFound", message: "Ingestion job not found" });
  });
});
