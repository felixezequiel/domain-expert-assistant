import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type {
  UserRepositoryPort,
  SessionRepositoryPort,
  OpaqueSecretPort,
  ResolvedPrincipal,
} from "../types.ts";
import { UserId } from "../../domain/identifiers/UserId.ts";

/**
 * Resolves a session token to the current principal (ADR-010), called by the edge on
 * every request to open the Actor Context. Returns null (not an error) when the token is
 * unknown, expired or revoked, or the user is gone/disabled — giving immediate revocation
 * and always-fresh roles without trusting anything baked into the token.
 */
export class ResolveSessionUseCase implements UseCase<string, ResolvedPrincipal | null> {
  private readonly sessionRepository: SessionRepositoryPort;
  private readonly userRepository: UserRepositoryPort;
  private readonly opaqueSecret: OpaqueSecretPort;
  private readonly clock: () => Date;

  constructor(
    sessionRepository: SessionRepositoryPort,
    userRepository: UserRepositoryPort,
    opaqueSecret: OpaqueSecretPort,
    clock: () => Date = () => new Date(),
  ) {
    this.sessionRepository = sessionRepository;
    this.userRepository = userRepository;
    this.opaqueSecret = opaqueSecret;
    this.clock = clock;
  }

  public async execute(token: string): Promise<ResolvedPrincipal | null> {
    const session = await this.sessionRepository.findByTokenHash(this.opaqueSecret.hash(token));
    if (session === null || !session.isValidAt(this.clock())) {
      return null;
    }

    const user = await this.userRepository.findById(new UserId(session.userId));
    if (user === null || user.status !== "active") {
      return null;
    }

    return {
      companyId: user.companyId,
      actorId: user.id.value,
      actorType: "user",
      roles: user.roles,
    };
  }
}
