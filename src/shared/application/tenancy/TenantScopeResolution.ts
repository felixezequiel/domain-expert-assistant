import type { Actor } from "../context/ActorContext.ts";
import { isPrivilegedActorType } from "../context/ActorContext.ts";
import { DomainError } from "../../domain/errors/DomainError.ts";

/**
 * Raised when tenant-scoped persistence is reached without a tenant and without a
 * privileged scope. Fail-closed (ADR-009): missing tenant is an error, never a
 * silent "return everything" or "return nothing" that would mask a bug.
 *
 * `kind` is "internal" to preserve the pre-ADR-026 status: this message never matched
 * the edges' substring `statusForError`, so it always became a 500 and no test pinned
 * a different status (ADR-026 §3 keep-status rule).
 */
export class MissingTenantContextError extends DomainError {
  constructor() {
    super(
      "tenancy.missingContext",
      "internal",
      undefined,
      "Tenant-scoped access denied: no tenant in the actor context and no privileged scope (fail-closed).",
    );
    this.name = "MissingTenantContextError";
  }
}

/**
 * The isolation decision the unit of work applies on begin (ADR-009):
 * - `filtered`   — enable the company filter for this tenant.
 * - `privileged` — deliberately disable the filter (operator/system cross-tenant scope).
 */
export type TenantScopeDecision =
  | { readonly kind: "filtered"; readonly companyId: string }
  | { readonly kind: "privileged" };

export function resolveTenantScope(actor: Actor | null): TenantScopeDecision {
  if (actor !== null && isPrivilegedActorType(actor.actorType)) {
    return { kind: "privileged" };
  }

  if (actor !== null && actor.companyId !== null) {
    return { kind: "filtered", companyId: actor.companyId };
  }

  throw new MissingTenantContextError();
}
