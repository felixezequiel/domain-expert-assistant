import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { ConsumerCredentialRepositoryPort } from "../../../identity/application/types.ts";
import { CredentialId } from "../../../identity/domain/identifiers/CredentialId.ts";
import type { CredentialUsageStagerPort, RecordCredentialUsageCommand } from "../types.ts";

/**
 * Records that a credential was just used (`lastUsedAt`) on every authenticated consumer
 * request (PRD-5 §9; auditability per PRD-0). Runs inside the consumer's actor context and
 * the unit of work: it loads the credential (tenant-filtered, since the consumer's company
 * scope is active), marks it used — which emits no domain event — and stages it through the
 * `CredentialUsageStagerPort` so the UnitOfWork persists it on commit. No direct flush
 * (ADR-004). Fail-soft: a credential that cannot be re-read is simply not stamped.
 */
export class RecordCredentialUsageUseCase
  implements UseCase<RecordCredentialUsageCommand, void>
{
  private readonly credentialRepository: ConsumerCredentialRepositoryPort;
  private readonly usageStager: CredentialUsageStagerPort;

  constructor(
    credentialRepository: ConsumerCredentialRepositoryPort,
    usageStager: CredentialUsageStagerPort,
  ) {
    this.credentialRepository = credentialRepository;
    this.usageStager = usageStager;
  }

  public async execute(command: RecordCredentialUsageCommand): Promise<void> {
    const credential = await this.credentialRepository.findById(new CredentialId(command.credentialId));
    if (credential === null) {
      return;
    }
    credential.markUsed(command.at);
    this.usageStager.stage(credential);
  }
}
