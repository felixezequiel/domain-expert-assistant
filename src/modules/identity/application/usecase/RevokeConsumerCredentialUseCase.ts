import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { Role } from "../../../../shared/domain/Role.ts";
import type { ConsumerCredentialRepositoryPort } from "../types.ts";
import type { RevokeConsumerCredentialCommand } from "../command/RevokeConsumerCredentialCommand.ts";
import type { ConsumerCredential } from "../../domain/aggregates/ConsumerCredential.ts";
import { getCurrentActor } from "../../../../shared/application/context/ActorContext.ts";

/**
 * Admin revokes a credential — it stops authenticating immediately (ADR-010).
 */
export class RevokeConsumerCredentialUseCase
  implements UseCase<RevokeConsumerCredentialCommand, ConsumerCredential>
{
  public readonly requiredRoles: ReadonlyArray<Role> = ["admin"];

  private readonly credentialRepository: ConsumerCredentialRepositoryPort;

  constructor(credentialRepository: ConsumerCredentialRepositoryPort) {
    this.credentialRepository = credentialRepository;
  }

  public async execute(command: RevokeConsumerCredentialCommand): Promise<ConsumerCredential> {
    const credential = await this.credentialRepository.findById(command.credentialId);
    const companyId = getCurrentActor()?.companyId ?? null;
    if (credential === null || credential.companyId !== companyId) {
      throw new Error("Credential not found: " + command.credentialId.value);
    }

    credential.revoke();
    return credential;
  }
}
