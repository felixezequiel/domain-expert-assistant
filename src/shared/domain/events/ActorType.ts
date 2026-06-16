/**
 * The nature of whoever originated an action (ADR-008 / ADR-009).
 *
 * - `user`     — a human authenticated against a tenant (the curation/admin UI).
 * - `consumer` — a machine principal (a `ConsumerCredential` / API key) reading the corpus.
 * - `system`   — an automatic job or migration acting on its own (no human responsible).
 * - `operator` — a named human of ours who provisions tenants (cross-tenant responsibility).
 *
 * `system` and `operator` are the privileged scopes that may act without a tenant
 * (see `isPrivilegedActorType`); `user` and `consumer` are always tenant-bound.
 */
export type ActorType = "user" | "consumer" | "system" | "operator";
