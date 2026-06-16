import { getCurrentActor, runWithActor } from "../../../application/context/ActorContext.ts";

/**
 * Tenant convenience layer over the single `ActorContext` (ADR-008). The actor context
 * is the source of truth for "who/which tenant"; these helpers derive the tenant from
 * it so the two can never diverge. The full edge (HTTP/MCP) opens an `ActorContext`
 * with a real actor; `runWithTenant` is a thin tenant-only scope used by tasks/tests.
 */
export function getCurrentCompanyId(): string | null {
  return getCurrentActor()?.companyId ?? null;
}

export function runWithTenant<T>(companyId: string, callback: () => Promise<T>): Promise<T> {
  return runWithActor({ companyId, actorId: null, actorType: null }, callback);
}
