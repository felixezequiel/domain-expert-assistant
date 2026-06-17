import type { Actor } from "../../../../shared/application/context/ActorContext.ts";
import type { SessionResolverPort } from "../../../../shared/application/ports/SessionResolverPort.ts";
import type { ResolveSessionUseCase } from "../../application/usecase/ResolveSessionUseCase.ts";
import { readSessionToken } from "./SessionCookie.ts";

/**
 * Identity's adapter for the shared `SessionResolverPort` (ADR-010/011 amendment): wraps the
 * session-cookie parsing + `ResolveSessionUseCase` so the shared edge (`authenticatedRoute`)
 * can resolve "who is calling" without the shared kernel importing this module. Returns null
 * (no actor) when there is no cookie token or the token resolves to no live principal — the
 * edge turns that into a 401. Authorization (roles) stays in the use case / ApplicationService.
 */
export class CookieSessionResolver implements SessionResolverPort {
  private readonly resolveSession: ResolveSessionUseCase;

  constructor(resolveSession: ResolveSessionUseCase) {
    this.resolveSession = resolveSession;
  }

  public async resolve(cookieHeader: string | undefined): Promise<Actor | null> {
    const token = readSessionToken(cookieHeader);
    if (token === null) {
      return null;
    }
    const principal = await this.resolveSession.execute(token);
    if (principal === null) {
      return null;
    }
    return {
      companyId: principal.companyId,
      actorId: principal.actorId,
      actorType: principal.actorType,
      roles: principal.roles,
    };
  }
}
