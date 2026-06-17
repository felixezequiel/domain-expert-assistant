import type { Actor } from "../context/ActorContext.ts";

/**
 * Resolves a raw `Cookie` header to the authenticated `Actor`, or `null` when there is no
 * valid session. The adapter lives in the Identity module (`CookieSessionResolver`, wrapping
 * `ResolveSessionUseCase` + the session-cookie parsing); the shared edge (`authenticatedRoute`)
 * depends only on this port. That hoists authentication to the outermost layer without the
 * shared kernel importing a module — the same ports-and-adapters seam used by `AuthorizerPort`
 * and `UserDirectoryPort`.
 *
 * This answers "who is calling" only. Authorization (which roles an action requires) stays in
 * the use case (`requiredRoles`) and is enforced once by the `ApplicationService` (ADR-011).
 */
export interface SessionResolverPort {
  resolve(cookieHeader: string | undefined): Promise<Actor | null>;
}
