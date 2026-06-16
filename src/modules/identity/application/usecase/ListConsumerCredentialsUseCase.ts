import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { Role } from "../../../../shared/domain/Role.ts";
import type { ConsumerCredentialRepositoryPort, ConsumerCredentialView } from "../types.ts";
import type { ConsumerCredential } from "../../domain/aggregates/ConsumerCredential.ts";
import { getCurrentActor } from "../../../../shared/application/context/ActorContext.ts";

/**
 * Admin lists their org's credentials — never exposing the secret or its hash, only the
 * keyPrefix display label and metadata.
 */
export class ListConsumerCredentialsUseCase
  implements UseCase<void, ReadonlyArray<ConsumerCredentialView>>
{
  public readonly requiredRoles: ReadonlyArray<Role> = ["admin"];

  private readonly credentialRepository: ConsumerCredentialRepositoryPort;

  constructor(credentialRepository: ConsumerCredentialRepositoryPort) {
    this.credentialRepository = credentialRepository;
  }

  public async execute(): Promise<ReadonlyArray<ConsumerCredentialView>> {
    const companyId = getCurrentActor()?.companyId ?? null;
    if (companyId === null) {
      throw new Error("Cannot list credentials without a tenant in the context");
    }

    const credentials = await this.credentialRepository.listByCompany(companyId);
    const views: Array<ConsumerCredentialView> = [];
    for (const credential of credentials) {
      views.push(ListConsumerCredentialsUseCase.toView(credential));
    }
    return views;
  }

  private static toView(credential: ConsumerCredential): ConsumerCredentialView {
    return {
      id: credential.id.value,
      name: credential.name,
      keyPrefix: credential.keyPrefix,
      collectionIds: credential.scope.collectionIds,
      sensitivityCeiling: credential.scope.sensitivityCeiling.name,
      status: credential.status,
      createdAt: credential.createdAt.toISOString(),
      lastUsedAt: credential.lastUsedAt === null ? null : credential.lastUsedAt.toISOString(),
    };
  }
}
