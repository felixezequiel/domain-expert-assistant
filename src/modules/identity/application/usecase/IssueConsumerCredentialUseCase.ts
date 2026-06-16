import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { Role } from "../../../../shared/domain/Role.ts";
import type { ConsumerCredentialRepositoryPort, OpaqueSecretPort } from "../types.ts";
import type { IssueConsumerCredentialCommand } from "../command/IssueConsumerCredentialCommand.ts";
import { ConsumerCredential } from "../../domain/aggregates/ConsumerCredential.ts";
import { getCurrentActor } from "../../../../shared/application/context/ActorContext.ts";

export interface IssueConsumerCredentialResult {
  readonly credential: ConsumerCredential;
  readonly secret: string;
}

/**
 * Admin issues an API key for an AI consumer. The plaintext secret is returned exactly
 * once; only keyPrefix (display) + secretHash (verification) are persisted (ADR-010).
 */
export class IssueConsumerCredentialUseCase
  implements UseCase<IssueConsumerCredentialCommand, IssueConsumerCredentialResult>
{
  public readonly requiredRoles: ReadonlyArray<Role> = ["admin"];

  private readonly credentialRepository: ConsumerCredentialRepositoryPort;
  private readonly opaqueSecret: OpaqueSecretPort;

  constructor(credentialRepository: ConsumerCredentialRepositoryPort, opaqueSecret: OpaqueSecretPort) {
    this.credentialRepository = credentialRepository;
    this.opaqueSecret = opaqueSecret;
  }

  public async execute(
    command: IssueConsumerCredentialCommand,
  ): Promise<IssueConsumerCredentialResult> {
    const actor = getCurrentActor();
    const companyId = actor?.companyId ?? null;
    const createdBy = actor?.actorId ?? null;
    if (companyId === null || createdBy === null) {
      throw new Error("Cannot issue a credential without a tenant/actor in the context");
    }

    const secret = this.opaqueSecret.generate();
    const credential = ConsumerCredential.issue(
      command.credentialId,
      companyId,
      command.name,
      secret.prefix,
      this.opaqueSecret.hash(secret.plaintext),
      command.scope,
      createdBy,
    );

    return { credential, secret: secret.plaintext };
  }
}
