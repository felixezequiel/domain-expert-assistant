import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import type { ServerResponse } from "node:http";
import type { HttpServer, RawRouteHandler } from "./HttpServer.ts";

const HTTP_OK = 200;

// This file lives at src/shared/infrastructure/http/SpaController.ts, so the repo root is
// four directories up. Resolving from import.meta.url keeps the dist path correct
// regardless of the process working directory.
function defaultDistPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "..", "..", "..", "..");
  return join(repoRoot, "web", "dist");
}

const PLACEHOLDER_HTML = [
  "<!doctype html>",
  '<html lang="en"><head><meta charset="utf-8"><title>Domain Expert</title></head>',
  "<body><h1>SPA not built</h1>",
  "<p>The Curation &amp; Admin UI has not been built yet. Run:</p>",
  "<pre>npm --prefix web run build</pre>",
  "<p>then reload this page.</p>",
  "</body></html>",
].join("\n");

/**
 * Serves the built Curation & Admin SPA (ADR-023) from the same origin as the REST API, so
 * the httpOnly session cookie works without CORS. The SPA uses a HashRouter, so the server
 * only ever serves three things: "/", "/index.html" (both return the built index.html), and
 * "/assets/*" (the hashed JS/CSS bundles) — there is no history fallback to implement.
 *
 * Registered LAST in the composition root so it cannot shadow API routes; it only claims
 * "/", "/index.html", and the "/assets/" static prefix. If the build is absent it returns a
 * 200 placeholder telling the operator to build — it never crashes the server.
 */
export class SpaController {
  private readonly distPath: string;

  constructor(distPath: string = defaultDistPath()) {
    this.distPath = distPath;
  }

  public register(httpServer: HttpServer): void {
    const serveIndex: RawRouteHandler = (_request, response: ServerResponse): void => {
      // Always revalidate the entry document so that after a rebuild the browser picks up the
      // new content-hashed asset URLs immediately (without no-cache, browsers heuristically
      // cache index.html and keep loading stale bundles). The hashed /assets/* are immutable.
      response.writeHead(HTTP_OK, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      });
      response.end(this.readIndexHtml());
    };

    httpServer.rawGet("/", serveIndex);
    httpServer.rawGet("/index.html", serveIndex);
    httpServer.serveStatic("/assets/", join(this.distPath, "assets"));
  }

  private readIndexHtml(): string {
    const indexPath = join(this.distPath, "index.html");
    if (!existsSync(indexPath)) {
      return PLACEHOLDER_HTML;
    }
    return readFileSync(indexPath, "utf8");
  }
}
