import { Entity } from "../../../../shared/domain/entities/Entity.ts";
import type { SessionId } from "../identifiers/SessionId.ts";

interface SessionProps {
  readonly tokenHash: string;
  readonly userId: string;
  readonly companyId: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  revoked: boolean;
}

/**
 * Opaque, server-side, revocable session (ADR-010). The session token plaintext is shown
 * once at login; only its hash is stored. Not an event-sourced aggregate — it is auth
 * state persisted explicitly via the SessionRepository, so it emits no domain events
 * (which would otherwise bloat the event store). Immediate revocation = revoke the
 * session (or the per-request user-status check) rather than waiting for a token to expire.
 */
export class Session extends Entity<SessionId, SessionProps> {
  public get tokenHash(): string {
    return this.props.tokenHash;
  }

  public get userId(): string {
    return this.props.userId;
  }

  public get companyId(): string {
    return this.props.companyId;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get expiresAt(): Date {
    return this.props.expiresAt;
  }

  public get isRevoked(): boolean {
    return this.props.revoked;
  }

  public static start(
    id: SessionId,
    tokenHash: string,
    userId: string,
    companyId: string,
    now: Date,
    ttlMs: number,
  ): Session {
    return new Session(id, {
      tokenHash,
      userId,
      companyId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
      revoked: false,
    });
  }

  public static reconstitute(
    id: SessionId,
    tokenHash: string,
    userId: string,
    companyId: string,
    createdAt: Date,
    expiresAt: Date,
    revoked: boolean,
  ): Session {
    return new Session(id, { tokenHash, userId, companyId, createdAt, expiresAt, revoked });
  }

  public revoke(): void {
    this.props.revoked = true;
  }

  public isValidAt(now: Date): boolean {
    return !this.props.revoked && now.getTime() < this.props.expiresAt.getTime();
  }
}
