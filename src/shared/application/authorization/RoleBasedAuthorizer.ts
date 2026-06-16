import type { AuthorizerPort } from "../../ports/AuthorizerPort.ts";
import type { Role } from "../../domain/Role.ts";
import { getCurrentActor } from "../context/ActorContext.ts";

export class UnauthorizedError extends Error {
  constructor(requiredRoles: ReadonlyArray<Role>) {
    super("Forbidden: requires one of the roles [" + requiredRoles.join(", ") + "].");
    this.name = "UnauthorizedError";
  }
}

/**
 * A use case declares the roles it requires by exposing `requiredRoles`. The
 * declaration mechanism is intentionally light (ADR-011 left it open): a plain readonly
 * property, detected structurally, keeps the template's low-boilerplate, declarative style.
 */
export interface RoleRestricted {
  readonly requiredRoles: ReadonlyArray<Role>;
}

export function isRoleRestricted(useCase: object): useCase is RoleRestricted {
  return Array.isArray((useCase as Partial<RoleRestricted>).requiredRoles);
}

/**
 * Default authorizer: the actor (any required role) must be present in the actor
 * context. Roles are read fresh from the context (ADR-010), never reloaded. The Identity
 * context may provide a richer AuthorizerPort, but coarse role membership needs no more.
 */
export class RoleBasedAuthorizer implements AuthorizerPort {
  public authorize(requiredRoles: ReadonlyArray<Role>): void {
    if (requiredRoles.length === 0) {
      return;
    }

    const actorRoles = getCurrentActor()?.roles ?? [];
    for (const role of actorRoles) {
      if (requiredRoles.includes(role)) {
        return;
      }
    }

    throw new UnauthorizedError(requiredRoles);
  }
}
