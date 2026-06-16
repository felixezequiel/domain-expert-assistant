import type { Organization } from "../domain/aggregates/Organization.ts";
import type { OrganizationId } from "../domain/identifiers/OrganizationId.ts";
import type { User } from "../domain/aggregates/User.ts";
import type { UserId } from "../domain/identifiers/UserId.ts";
import type { ConsumerCredential } from "../domain/aggregates/ConsumerCredential.ts";
import type { CredentialId } from "../domain/identifiers/CredentialId.ts";
import type { Session } from "../domain/entities/Session.ts";
import type { Role } from "../../../shared/domain/Role.ts";

/**
 * Secondary ports for the Identity context. Repository `save` is invoked by the
 * InMemory/MikroORM unit-of-work adapters (aggregates auto-persist via tracking); reads
 * are called directly by use cases. `SessionRepositoryPort.save` is the one explicit
 * write — sessions are an auth artifact, not an event-sourced business aggregate.
 *
 * These ports grow with each Identity slice (invitation-token lookup, admin lookup for
 * the last-admin rule, consumer credentials) as those use cases land.
 */
export interface OrganizationRepositoryPort {
  save(organization: Organization): Promise<void>;
  findById(id: OrganizationId): Promise<Organization | null>;
  existsByName(name: string): Promise<boolean>;
}

export interface UserRepositoryPort {
  save(user: User): Promise<void>;
  findById(id: UserId): Promise<User | null>;
  // Email is globally unique, so login resolves a user with no tenant hint.
  findByEmail(email: string): Promise<User | null>;
  existsByEmail(email: string): Promise<boolean>;
  // AcceptInvitation looks up the invited user by the hashed one-time token.
  findByInvitationTokenHash(tokenHash: string): Promise<User | null>;
  // Backs the cross-aggregate "cannot remove/disable the last admin" rule (ADR-011).
  countActiveAdmins(companyId: string): Promise<number>;
}

export interface ConsumerCredentialRepositoryPort {
  save(credential: ConsumerCredential): Promise<void>;
  findById(id: CredentialId): Promise<ConsumerCredential | null>;
  // Consumer auth hashes the presented key and looks it up by the indexed secret hash;
  // keyPrefix is kept only as a non-secret display label (ADR-010).
  findBySecretHash(secretHash: string): Promise<ConsumerCredential | null>;
  listByCompany(companyId: string): Promise<ReadonlyArray<ConsumerCredential>>;
}

/** Credential listing for admins — never includes the secret or its hash. */
export interface ConsumerCredentialView {
  readonly id: string;
  readonly name: string;
  readonly keyPrefix: string;
  readonly collectionIds: ReadonlyArray<string>;
  readonly sensitivityCeiling: string;
  readonly status: string;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
}

export interface SessionRepositoryPort {
  save(session: Session): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  revoke(sessionId: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

/**
 * Password hashing (argon2id, ADR-010): slow + memory-hard, with constant-time verify.
 */
export interface PasswordHasherPort {
  hash(plaintext: string): Promise<string>;
  verify(plaintext: string, hash: string): Promise<boolean>;
}

export interface GeneratedSecret {
  readonly plaintext: string;
  readonly prefix: string;
}

/**
 * Opaque high-entropy secrets (API keys, session tokens, invitation tokens). Because the
 * secret is high-entropy, a fast hash is sufficient (unlike passwords). The plaintext is
 * shown exactly once; only `prefix` (for lookup) + the hash are persisted.
 */
export interface OpaqueSecretPort {
  generate(): GeneratedSecret;
  hash(plaintext: string): string;
  verify(plaintext: string, hash: string): boolean;
}

/**
 * What ResolveSession hands the edge to open the Actor Context (ADR-008/010). Roles are
 * read fresh from the User on every request, so a role/disable change takes effect at once.
 */
export interface ResolvedPrincipal {
  readonly companyId: string;
  readonly actorId: string;
  readonly actorType: "user";
  readonly roles: ReadonlyArray<Role>;
}

export interface AuthResult {
  readonly token: string;
  readonly userId: string;
  readonly companyId: string;
  readonly expiresAt: Date;
}
