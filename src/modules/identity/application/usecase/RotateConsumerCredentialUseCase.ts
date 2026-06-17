import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { Role } from "../../../../shared/domain/Role.ts";
import type { ConsumerCredentialRepositoryPort, OpaqueSecretPort } from "../types.ts";
import type { RotateConsumerCredentialCommand } from "../command/RotateConsumerCredentialCommand.ts";
import type { ConsumerCredential } from "../../domain/aggregates/ConsumerCredential.ts";
import { getCurrentActor } from "../../../../shared/application/context/ActorContext.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

export interface RotateConsumerCredentialResult {
  readonly credential: ConsumerCredential;
  readonly secret: string;
}

/**
 * Admin rotates a credential's secret, keeping the same scope. The new plaintext is
 * returned once; the old secret stops working immediately.
 */
export class RotateConsumerCredentialUseCase
  implements UseCase<RotateConsumerCredentialCommand, RotateConsumerCredentialResult>
{
  public readonly requiredRoles: ReadonlyArray<Role> = ["admin"];

  private readonly credentialRepository: ConsumerCredentialRepositoryPort;
  private readonly opaqueSecret: OpaqueSecretPort;

  constructor(credentialRepository: ConsumerCredentialRepositoryPort, opaqueSecret: OpaqueSecretPort) {
    this.credentialRepository = credentialRepository;
    this.opaqueSecret = opaqueSecret;
  }

  public async execute(
    command: RotateConsumerCredentialCommand,
  ): Promise<RotateConsumerCredentialResult> {
    const credential = await this.findOwnedCredential(command);

    const secret = this.opaqueSecret.generate();
    credential.rotate(secret.prefix, this.opaqueSecret.hash(secret.plaintext));
    return { credential, secret: secret.plaintext };
  }

  private async findOwnedCredential(
    command: RotateConsumerCredentialCommand,
  ): Promise<ConsumerCredential> {
    const credential = await this.credentialRepository.findById(command.credentialId);
    const companyId = getCurrentActor()?.companyId ?? null;
    if (credential === null || credential.companyId !== companyId) {
      throw new DomainError(
        "identity.credentialNotFound",
        "validation",
        { id: command.credentialId.value },
        "Credential not found: " + command.credentialId.value,
      );
    }
    return credential;
  }
}
