import type {
  OrganizationRepositoryPort,
  UserRepositoryPort,
  SessionRepositoryPort,
  PasswordHasherPort,
  OpaqueSecretPort,
  GeneratedSecret,
} from "../types.ts";
import type { Organization } from "../../domain/aggregates/Organization.ts";
import type { OrganizationId } from "../../domain/identifiers/OrganizationId.ts";
import type { User } from "../../domain/aggregates/User.ts";
import type { UserId } from "../../domain/identifiers/UserId.ts";
import type { Session } from "../../domain/entities/Session.ts";

/**
 * In-memory port test doubles for the Identity context. They live in the application
 * layer (implementing application ports) so application unit tests depend only on ports,
 * never on a concrete infrastructure adapter (hexagonal dependency rule). Production uses
 * the MikroORM adapters; these back unit and module integration tests.
 */
export class FakeOrganizationRepository implements OrganizationRepositoryPort {
  private readonly organizations = new Map<string, Organization>();

  public async save(organization: Organization): Promise<void> {
    this.organizations.set(organization.id.value, organization);
  }

  public async findById(id: OrganizationId): Promise<Organization | null> {
    return this.organizations.get(id.value) ?? null;
  }

  public async existsByName(name: string): Promise<boolean> {
    for (const organization of this.organizations.values()) {
      if (organization.name.value === name) {
        return true;
      }
    }
    return false;
  }
}

export class FakeUserRepository implements UserRepositoryPort {
  private readonly users = new Map<string, User>();

  public async save(user: User): Promise<void> {
    this.users.set(user.id.value, user);
  }

  public async findById(id: UserId): Promise<User | null> {
    return this.users.get(id.value) ?? null;
  }

  public async findByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.value === normalized) {
        return user;
      }
    }
    return null;
  }

  public async existsByEmail(email: string): Promise<boolean> {
    return (await this.findByEmail(email)) !== null;
  }

  public async findByInvitationTokenHash(tokenHash: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.invitationTokenHash === tokenHash) {
        return user;
      }
    }
    return null;
  }

  public async countActiveAdmins(companyId: string): Promise<number> {
    let count = 0;
    for (const user of this.users.values()) {
      if (user.companyId === companyId && user.status === "active" && user.isAdmin()) {
        count += 1;
      }
    }
    return count;
  }
}

export class FakeSessionRepository implements SessionRepositoryPort {
  private readonly sessions = new Map<string, Session>();

  public async save(session: Session): Promise<void> {
    this.sessions.set(session.id.value, session);
  }

  public async findByTokenHash(tokenHash: string): Promise<Session | null> {
    for (const session of this.sessions.values()) {
      if (session.tokenHash === tokenHash) {
        return session;
      }
    }
    return null;
  }

  public async revoke(sessionId: string): Promise<void> {
    this.sessions.get(sessionId)?.revoke();
  }

  public async revokeAllForUser(userId: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        session.revoke();
      }
    }
  }
}

/**
 * Deterministic hashing doubles — `h:<plaintext>` for passwords, `H:<plaintext>` for
 * opaque secrets — so tests can assert stored hashes without real crypto.
 */
export class FakePasswordHasher implements PasswordHasherPort {
  public async hash(plaintext: string): Promise<string> {
    return "h:" + plaintext;
  }

  public async verify(plaintext: string, hash: string): Promise<boolean> {
    return hash === "h:" + plaintext;
  }
}

export class FakeOpaqueSecret implements OpaqueSecretPort {
  private counter = 0;

  public generate(): GeneratedSecret {
    this.counter += 1;
    return { plaintext: "tok-" + this.counter, prefix: "pre-" + this.counter };
  }

  public hash(plaintext: string): string {
    return "H:" + plaintext;
  }

  public verify(plaintext: string, hash: string): boolean {
    return hash === "H:" + plaintext;
  }
}
