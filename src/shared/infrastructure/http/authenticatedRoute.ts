import type { IncomingMessage, ServerResponse } from "node:http";
import type { RawRouteHandler, RouteParams } from "./HttpServer.ts";
import { toErrorResponse } from "./errorResponse.ts";
import { DomainError } from "../../domain/errors/DomainError.ts";
import { runWithActor, type Actor } from "../../application/context/ActorContext.ts";
import type { SessionResolverPort } from "../../application/ports/SessionResolverPort.ts";

/**
 * What an edge route handler returns; the shared respond helpers serialize it. `headers`
 * carries edge-only concerns such as `Set-Cookie` (login/logout) so the handler never touches
 * the raw response. Replaces the per-module `RouteResult` + `respond`/`respondError` copies.
 */
export interface RouteResult {
  readonly statusCode: number;
  readonly body: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

export function respondResult(response: ServerResponse, result: RouteResult): void {
  response.writeHead(result.statusCode, { "Content-Type": "application/json", ...result.headers });
  response.end(JSON.stringify(result.body));
}

/** Serializes any thrown error to the stable coded shape (ADR-026). */
export function respondError(response: ServerResponse, error: unknown): void {
  respondResult(response, toErrorResponse(error));
}

/**
 * The async core, exported for direct testing (the returned `RawRouteHandler` is fire-and-forget).
 * Resolves the principal, opens the `ActorContext`, runs the handler, and serializes the result
 * or any thrown error.
 */
export async function runAuthenticatedRoute(
  sessionResolver: SessionResolverPort,
  handler: (request: IncomingMessage, params: RouteParams, actor: Actor) => Promise<RouteResult>,
  request: IncomingMessage,
  response: ServerResponse,
  params: RouteParams,
): Promise<void> {
  try {
    const actor = await sessionResolver.resolve(request.headers.cookie);
    if (actor === null) {
      respondError(
        response,
        new DomainError("common.unauthorized", "unauthorized", undefined, "Unauthorized"),
      );
      return;
    }
    respondResult(response, await runWithActor(actor, () => handler(request, params, actor)));
  } catch (error) {
    respondError(response, error);
  }
}

/**
 * Hoists cookie-session authentication to the outermost layer (ADR-011 amendment): one wrapper
 * resolves the principal via the `SessionResolverPort`, opens the request-scoped `ActorContext`,
 * runs the handler, and serializes its `RouteResult` (or coded error). Each module composes its
 * routes with this instead of copy-pasting an `authed` wrapper. Authorization (RBAC) is untouched
 * — it stays declared on the use case (`requiredRoles`) and enforced by the `ApplicationService`.
 *
 * Public routes (login, invitation accept, operator provisioning) and bearer/API-key routes
 * (Consumption) do NOT use this wrapper — they authenticate differently or not at all.
 */
export function authenticatedRoute(
  sessionResolver: SessionResolverPort,
  handler: (request: IncomingMessage, params: RouteParams, actor: Actor) => Promise<RouteResult>,
): RawRouteHandler {
  return (request, response, params) => {
    void runAuthenticatedRoute(sessionResolver, handler, request, response, params);
  };
}
