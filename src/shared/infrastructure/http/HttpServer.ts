import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { extractOrGenerateCorrelationId, runWithCorrelationId } from "./CorrelationIdMiddleware.ts";

export interface HttpRoute {
  readonly method: string;
  readonly path: string;
  readonly handler: RouteHandler;
}

export interface HttpResponse {
  readonly statusCode: number;
  readonly body: unknown;
}

export type RouteParams = Record<string, string>;

export type RouteHandler = (
  requestBody: Record<string, unknown>,
  params: RouteParams,
) => Promise<HttpResponse>;

export type RawRouteHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  params: RouteParams,
) => void;

interface RawHttpRoute {
  readonly method: string;
  readonly path: string;
  readonly rawHandler: RawRouteHandler;
}

interface StaticRoute {
  readonly urlPrefix: string;
  readonly directoryPath: string;
}

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".ico": "image/x-icon",
};

interface RouteMatch {
  readonly route: HttpRoute;
  readonly params: RouteParams;
}

interface HttpError extends Error {
  readonly statusCode: number;
}

function isHttpError(error: unknown): error is HttpError {
  return error instanceof Error && typeof (error as HttpError).statusCode === "number";
}

export class HttpServer {
  private readonly routes: Array<HttpRoute> = [];
  private readonly rawRoutes: Array<RawHttpRoute> = [];
  private readonly staticRoutes: Array<StaticRoute> = [];
  private server: Server | undefined;

  public get routeCount(): number {
    return this.routes.length;
  }

  public get(path: string, handler: RouteHandler): void {
    this.routes.push({ method: "GET", path, handler });
  }

  public post(path: string, handler: RouteHandler): void {
    this.routes.push({ method: "POST", path, handler });
  }

  public put(path: string, handler: RouteHandler): void {
    this.routes.push({ method: "PUT", path, handler });
  }

  public delete(path: string, handler: RouteHandler): void {
    this.routes.push({ method: "DELETE", path, handler });
  }

  public rawGet(path: string, handler: RawRouteHandler): void {
    this.rawRoutes.push({ method: "GET", path, rawHandler: handler });
  }

  public rawPost(path: string, handler: RawRouteHandler): void {
    this.rawRoutes.push({ method: "POST", path, rawHandler: handler });
  }

  public rawPut(path: string, handler: RawRouteHandler): void {
    this.rawRoutes.push({ method: "PUT", path, rawHandler: handler });
  }

  public rawDelete(path: string, handler: RawRouteHandler): void {
    this.rawRoutes.push({ method: "DELETE", path, rawHandler: handler });
  }

  /** Reads and JSON-parses a request body; shared by the framed handlers and raw routes. */
  public static readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      let data = "";
      request.on("data", (chunk: Buffer) => {
        data = data + chunk.toString();
      });
      request.on("end", () => {
        if (data.length === 0) {
          resolve({});
          return;
        }
        try {
          resolve(JSON.parse(data) as Record<string, unknown>);
        } catch {
          reject(new Error("Invalid JSON body"));
        }
      });
    });
  }

  public serveStatic(urlPrefix: string, directoryPath: string): void {
    this.staticRoutes.push({ urlPrefix, directoryPath });
  }

  public start(port: number): Promise<number> {
    return new Promise((resolve) => {
      this.server = createServer((request, response) => {
        this.handleRequest(request, response);
      });

      this.server.listen(port, "0.0.0.0", () => {
        const address = this.server!.address();
        const assignedPort = typeof address === "object" && address !== null ? address.port : port;
        resolve(assignedPort);
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server === undefined) {
        resolve();
        return;
      }

      this.server.close((error) => {
        this.server = undefined;
        if (error !== undefined && error !== null) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  private setCorsHeaders(response: ServerResponse): void {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Correlation-Id",
    );
  }

  private handleRequest(request: IncomingMessage, response: ServerResponse): void {
    this.setCorsHeaders(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Correlation-Id",
      });
      response.end();
      return;
    }

    if (request.method === "GET" && this.tryServeStaticFile(request, response)) {
      return;
    }

    const rawMatch = this.matchRawRoute(request.method, request.url);
    if (rawMatch !== undefined) {
      rawMatch.route.rawHandler(request, response, rawMatch.params);
      return;
    }

    const correlationId = extractOrGenerateCorrelationId(request);

    runWithCorrelationId(correlationId, async () => {
      const match = this.matchRoute(request.method, request.url);

      if (match === undefined) {
        this.sendJson(response, 404, { error: "Not Found" });
        return;
      }

      try {
        const body = await this.readBody(request);
        const result = await match.route.handler(body, match.params);
        this.sendJson(response, result.statusCode, result.body);
      } catch (error: unknown) {
        if (isHttpError(error)) {
          this.sendJson(response, error.statusCode, { error: error.message });
        } else {
          const message = error instanceof Error ? error.message : "Internal Server Error";
          this.sendJson(response, 500, { error: message });
        }
      }
    }).catch(() => {
      // runWithCorrelationId rejected — should not happen as inner errors are caught
    });
  }

  private tryServeStaticFile(request: IncomingMessage, response: ServerResponse): boolean {
    const url = request.url;
    if (url === undefined) return false;

    const [pathname] = url.split("?") as [string];

    for (const staticRoute of this.staticRoutes) {
      if (!pathname.startsWith(staticRoute.urlPrefix)) continue;

      const filename = pathname.substring(staticRoute.urlPrefix.length);
      const hasPathTraversal = filename.includes("..");
      if (hasPathTraversal || filename.length === 0) {
        this.sendJson(response, 400, { error: "Invalid filename" });
        return true;
      }

      const filePath = join(staticRoute.directoryPath, filename);
      if (!existsSync(filePath)) {
        this.sendJson(response, 404, { error: "File not found" });
        return true;
      }

      const ext = extname(filename).toLowerCase();
      const contentType = CONTENT_TYPE_BY_EXTENSION[ext] ?? "application/octet-stream";

      response.writeHead(200, { "Content-Type": contentType });
      createReadStream(filePath).pipe(response);
      return true;
    }

    return false;
  }

  private matchRawRoute(
    method: string | undefined,
    url: string | undefined,
  ): { route: RawHttpRoute; params: RouteParams } | undefined {
    if (method === undefined || url === undefined) return undefined;
    for (const route of this.rawRoutes) {
      if (route.method !== method) continue;
      const params = this.extractParams(route.path, url);
      if (params !== null) return { route, params };
    }
    return undefined;
  }

  private matchRoute(method: string | undefined, url: string | undefined): RouteMatch | undefined {
    if (method === undefined || url === undefined) {
      return undefined;
    }

    for (const route of this.routes) {
      if (route.method !== method) {
        continue;
      }

      const params = this.extractParams(route.path, url);
      if (params !== null) {
        return { route, params };
      }
    }

    return undefined;
  }

  private extractParams(routePath: string, requestUrl: string): RouteParams | null {
    const [pathname, queryString] = requestUrl.split("?") as [string, string | undefined];
    const routeSegments = routePath.split("/");
    const urlSegments = pathname.split("/");

    if (routeSegments.length !== urlSegments.length) {
      return null;
    }

    const params: Record<string, string> = {};

    for (let segmentIndex = 0; segmentIndex < routeSegments.length; segmentIndex++) {
      const routeSegment = routeSegments[segmentIndex]!;
      const urlSegment = urlSegments[segmentIndex]!;

      const isParam = routeSegment.startsWith(":");
      if (isParam) {
        const paramName = routeSegment.substring(1);
        params[paramName] = urlSegment;
      } else if (routeSegment !== urlSegment) {
        return null;
      }
    }

    if (queryString !== undefined) {
      const searchParams = new URLSearchParams(queryString);
      for (const [key, value] of searchParams) {
        params[key] = value;
      }
    }

    return params;
  }

  private readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
    return HttpServer.readJsonBody(request);
  }

  private sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
    response.writeHead(statusCode, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Correlation-Id",
    });
    response.end(JSON.stringify(body));
  }
}
