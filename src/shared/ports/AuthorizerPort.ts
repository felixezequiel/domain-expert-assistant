import type { Role } from "../domain/Role.ts";

/**
 * Coarse role-based authorization (ADR-011), invoked by the ApplicationService before
 * `execute` — a single, adapter-agnostic enforcement point (HTTP and MCP both pass
 * through it). The use case only *declares* the roles it requires; the authorizer reads
 * the actor's roles from the actor context (resolved fresh at the edge, ADR-010) and
 * throws when none match. Business invariants that mention the actor (reviewer ≠ author,
 * last admin, …) are domain rules, NOT authorization — they never live here.
 */
export interface AuthorizerPort {
  authorize(requiredRoles: ReadonlyArray<Role>): void;
}
