import { AggregateRoot } from "../../../../shared/domain/aggregates/AggregateRoot.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";
import type { TenantScoped } from "../../../../shared/domain/TenantScoped.ts";
import type { CredentialId } from "../identifiers/CredentialId.ts";
import type { CredentialScope } from "../valueObjects/CredentialScope.ts";
import { ConsumerCredentialIssuedEvent } from "../events/ConsumerCredentialIssuedEvent.ts";
import { ConsumerCredentialRotatedEvent } from "../events/ConsumerCredentialRotatedEvent.ts";
import { ConsumerCredentialRevokedEvent } from "../events/ConsumerCredentialRevokedEvent.ts";

export type CredentialStatus = "active" | "revoked";

interface ConsumerCredentialProps {
  readonly companyId: string;
  readonly name: string;
  keyPrefix: string;
  secretHash: string;
  scope: CredentialScope;
  status: CredentialStatus;
  readonly createdBy: string;
  readonly createdAt: Date;
  lastUsedAt: Date | null;
}

/**
 * A machine principal (API key) for an AI consumer. The plaintext secret is generated
 * and shown exactly once at the edge; the aggregate only ever holds `keyPrefix` (for fast
 * lookup) + `secretHash` (for verification) — never the plaintext (ADR-010). A revoked
 * credential stops authenticating immediately.
 */
export class ConsumerCredential
  extends AggregateRoot<CredentialId, ConsumerCredentialProps>
  implements TenantScoped
{
  public get companyId(): string {
    return this.props.companyId;
  }

  public get name(): string {
    return this.props.name;
  }

  public get keyPrefix(): string {
    return this.props.keyPrefix;
  }

  public get secretHash(): string {
    return this.props.secretHash;
  }

  public get scope(): CredentialScope {
    return this.props.scope;
  }

  public get status(): CredentialStatus {
    return this.props.status;
  }

  public get createdBy(): string {
    return this.props.createdBy;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get lastUsedAt(): Date | null {
    return this.props.lastUsedAt;
  }

  public isActive(): boolean {
    return this.props.status === "active";
  }

  public static issue(
    id: CredentialId,
    companyId: string,
    name: string,
    keyPrefix: string,
    secretHash: string,
    scope: CredentialScope,
    createdBy: string,
  ): ConsumerCredential {
    const credential = new ConsumerCredential(id, {
      companyId,
      name,
      keyPrefix,
      secretHash,
      scope,
      status: "active",
      createdBy,
      createdAt: new Date(),
      lastUsedAt: null,
    });
    credential.addDomainEvent(new ConsumerCredentialIssuedEvent(id.value, keyPrefix, createdBy));
    return credential;
  }

  public static reconstitute(
    id: CredentialId,
    companyId: string,
    name: string,
    keyPrefix: string,
    secretHash: string,
    scope: CredentialScope,
    status: CredentialStatus,
    createdBy: string,
    createdAt: Date,
    lastUsedAt: Date | null,
  ): ConsumerCredential {
    return new ConsumerCredential(id, {
      companyId,
      name,
      keyPrefix,
      secretHash,
      scope,
      status,
      createdBy,
      createdAt,
      lastUsedAt,
    });
  }

  public rotate(keyPrefix: string, secretHash: string): void {
    if (this.props.status === "revoked") {
      throw new DomainError(
        "identity.rotateRevokedCredential",
        "internal",
        { id: this.id.value },
        "Cannot rotate a revoked credential: " + this.id.value,
      );
    }
    this.props.keyPrefix = keyPrefix;
    this.props.secretHash = secretHash;
    this.addDomainEvent(new ConsumerCredentialRotatedEvent(this.id.value, keyPrefix));
  }

  public revoke(): void {
    if (this.props.status === "revoked") {
      return;
    }
    this.props.status = "revoked";
    this.addDomainEvent(new ConsumerCredentialRevokedEvent(this.id.value));
  }

  public markUsed(at: Date): void {
    this.props.lastUsedAt = at;
  }
}
