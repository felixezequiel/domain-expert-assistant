import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { ConsumerCredentialRepositoryPort, OpaqueSecretPort } from "../types.ts";
import type { ConsumerCredential } from "../../domain/aggregates/ConsumerCredential.ts";

/**
 * Resolves a presented API key to an active credential (used by the consumption gateway,
 * PRD-5, to open the consumer Actor Context and apply scope). Hashes the key and looks it
 * up by the indexed secret hash; returns null for unknown or revoked keys. Runs pre-auth
 * (system scope) and outside the event pipeline — a pure read.
 */
export class AuthenticateConsumerUseCase implements UseCase<string, ConsumerCredential | null> {
  private readonly credentialRepository: ConsumerCredentialRepositoryPort;
  private readonly opaqueSecret: OpaqueSecretPort;

  constructor(credentialRepository: ConsumerCredentialRepositoryPort, opaqueSecret: OpaqueSecretPort) {
    this.credentialRepository = credentialRepository;
    this.opaqueSecret = opaqueSecret;
  }

  public async execute(presentedKey: string): Promise<ConsumerCredential | null> {
    const credential = await this.credentialRepository.findBySecretHash(
      this.opaqueSecret.hash(presentedKey),
    );
    if (credential === null || !credential.isActive()) {
      return null;
    }
    return credential;
  }
}
