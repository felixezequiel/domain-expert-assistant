import { AsyncLocalStorage } from "node:async_hooks";
import type { ActorType } from "../../domain/events/ActorType.ts";

/**
 * The principal that originated the current unit of work (ADR-008).
 *
 * Opened exclusively at the edge (HTTP middleware / MCP session handler) from the
 * authenticated principal — never from client-controlled input. `companyId` always
 * comes from our own record (`User` / `ConsumerCredential`), so a client cannot forge
 * the tenant. The application layer reads this to stamp event envelopes and to decide
 * tenant isolation (see `resolveTenantScope`).
 *
 * This is the single source of truth for "who/which tenant"; `TenantContext`'s
 * `getCurrentCompanyId` derives from it so the two can never diverge.
 */
export interface Actor {
  readonly companyId: string | null;
  readonly actorId: string | null;
  readonly actorType: ActorType | null;
}

const actorStorage = new AsyncLocalStorage<Actor>();

const PRIVILEGED_ACTOR_TYPES: ReadonlySet<ActorType> = new Set<ActorType>(["system", "operator"]);

export function getCurrentActor(): Actor | null {
  return actorStorage.getStore() ?? null;
}

export function runWithActor<T>(actor: Actor, callback: () => Promise<T>): Promise<T> {
  return actorStorage.run(actor, callback);
}

/**
 * Privileged scopes (`system`, `operator`) may act without a tenant and bypass the
 * tenant read filter. `user` / `consumer` are always tenant-bound. A null actorType
 * (e.g. a bare tenant scope) is never privileged.
 */
export function isPrivilegedActorType(actorType: ActorType | null): boolean {
  return actorType !== null && PRIVILEGED_ACTOR_TYPES.has(actorType);
}

export function isPrivilegedScope(): boolean {
  const actor = getCurrentActor();
  return actor !== null && isPrivilegedActorType(actor.actorType);
}
