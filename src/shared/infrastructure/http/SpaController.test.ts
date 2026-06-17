import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { RawRouteHandler } from "./HttpServer.ts";
import { SpaController } from "./SpaController.ts";

class FakeHttpServer {
  public readonly rawRoutes = new Map<string, RawRouteHandler>();
  public readonly staticRoutes: Array<{ urlPrefix: string; directoryPath: string }> = [];

  public rawGet(path: string, handler: RawRouteHandler): void {
    this.rawRoutes.set("GET " + path, handler);
  }

  public serveStatic(urlPrefix: string, directoryPath: string): void {
    this.staticRoutes.push({ urlPrefix, directoryPath });
  }
}

class FakeResponse {
  public statusCode = 0;
  public headers: Record<string, string> = {};
  public payload = "";
  public writeHead(statusCode: number, headers?: Record<string, string>): void {
    this.statusCode = statusCode;
    if (headers !== undefined) {
      this.headers = headers;
    }
  }
  public end(body?: string): void {
    this.payload = body ?? "";
  }
}

describe("SpaController", () => {
  let httpServer: FakeHttpServer;

  beforeEach(() => {
    httpServer = new FakeHttpServer();
  });

  it("registers the SPA entry routes and the assets static route", () => {
    new SpaController().register(httpServer as never);

    assert.ok(httpServer.rawRoutes.has("GET /"), "should serve /");
    assert.ok(httpServer.rawRoutes.has("GET /index.html"), "should serve /index.html");
    // index.html links to /favicon.svg and browsers also fetch /favicon.ico — serve both.
    assert.ok(httpServer.rawRoutes.has("GET /favicon.svg"), "should serve /favicon.svg");
    assert.ok(httpServer.rawRoutes.has("GET /favicon.ico"), "should serve /favicon.ico");
    assert.equal(httpServer.staticRoutes.length, 1, "should mount one static route");
    assert.equal(httpServer.staticRoutes[0]!.urlPrefix, "/assets/");
    assert.ok(
      httpServer.staticRoutes[0]!.directoryPath.endsWith("web/dist/assets"),
      "static route should point at web/dist/assets",
    );
  });

  it("serves index.html as text/html with status 200 at /", () => {
    new SpaController().register(httpServer as never);
    const handler = httpServer.rawRoutes.get("GET /")!;
    const response = new FakeResponse();

    handler({} as never, response as never, {});

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["Content-Type"], "text/html; charset=utf-8");
    // no-cache so a rebuild's new hashed asset URLs are picked up immediately.
    assert.equal(response.headers["Cache-Control"], "no-cache");
    assert.ok(response.payload.length > 0, "should return some HTML");
  });

  it("answers /favicon.ico with 204 No Content when the build (and its favicon) is missing", () => {
    const controller = new SpaController("/tmp/does-not-exist-spa-dist");
    controller.register(httpServer as never);
    const response = new FakeResponse();

    httpServer.rawRoutes.get("GET /favicon.ico")!({} as never, response as never, {});

    assert.equal(response.statusCode, 204);
    assert.equal(response.payload, "");
  });

  it("falls back to a placeholder (never crashes) when the build is missing", () => {
    // Point at a directory that has no index.html so the placeholder branch runs.
    const controller = new SpaController("/tmp/does-not-exist-spa-dist");
    controller.register(httpServer as never);
    const response = new FakeResponse();

    httpServer.rawRoutes.get("GET /")!({} as never, response as never, {});

    assert.equal(response.statusCode, 200);
    assert.match(response.payload, /npm --prefix web run build/);
  });
});
