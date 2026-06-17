/**
 * Resolves user ids to human display names within the current tenant scope, so read models
 * can show *who* (a version's author, an audit actor) instead of a bare UUID.
 *
 * A cross-cutting read port in the spirit of ADR-013's OrganizationPolicyPort: the Identity
 * context owns the user table and provides the adapter, while consuming contexts (Knowledge's
 * version history, the Audit trail) depend only on this interface — never on Identity's
 * aggregates. Ids that are unknown, belong to another tenant, or are non-human
 * (system/operator) are simply absent from the returned map; callers fall back to the id.
 */
export interface UserDirectoryPort {
  resolveDisplayNames(userIds: ReadonlyArray<string>): Promise<ReadonlyMap<string, string>>;
}
