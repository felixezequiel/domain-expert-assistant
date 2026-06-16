import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type {
  UserRepositoryPort,
  SessionRepositoryPort,
  PasswordHasherPort,
  OpaqueSecretPort,
  AuthResult,
} from "../types.ts";
import type { AuthenticateCommand } from "../command/AuthenticateCommand.ts";
import { Session } from "../../domain/entities/Session.ts";
import { SessionId } from "../../domain/identifiers/SessionId.ts";

/**
 * Single error for every failure mode (unknown email, wrong password, disabled user) so
 * the response never reveals whether an account exists (ADR-010).
 */
export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid credentials");
    this.name = "InvalidCredentialsError";
  }
}

/**
 * Login (pre-auth, run by the edge in a system scope). Verifies email+password, then
 * mints an opaque server-side session — only the token hash is stored; the plaintext is
 * returned once to become the httpOnly cookie. Runs outside the event pipeline (no domain
 * event; the session is persisted explicitly).
 */
export class AuthenticateUseCase implements UseCase<AuthenticateCommand, AuthResult> {
  private readonly userRepository: UserRepositoryPort;
  private readonly sessionRepository: SessionRepositoryPort;
  private readonly passwordHasher: PasswordHasherPort;
  private readonly opaqueSecret: OpaqueSecretPort;
  private readonly sessionTtlMs: number;
  private readonly clock: () => Date;

  constructor(
    userRepository: UserRepositoryPort,
    sessionRepository: SessionRepositoryPort,
    passwordHasher: PasswordHasherPort,
    opaqueSecret: OpaqueSecretPort,
    sessionTtlMs: number,
    clock: () => Date = () => new Date(),
  ) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.passwordHasher = passwordHasher;
    this.opaqueSecret = opaqueSecret;
    this.sessionTtlMs = sessionTtlMs;
    this.clock = clock;
  }

  public async execute(command: AuthenticateCommand): Promise<AuthResult> {
    const user = await this.userRepository.findByEmail(command.email);
    if (user === null || user.status !== "active" || user.passwordHash === null) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await this.passwordHasher.verify(
      command.password,
      user.passwordHash.value,
    );
    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    const secret = this.opaqueSecret.generate();
    const now = this.clock();
    const session = Session.start(
      new SessionId(),
      this.opaqueSecret.hash(secret.plaintext),
      user.id.value,
      user.companyId,
      now,
      this.sessionTtlMs,
    );
    await this.sessionRepository.save(session);

    return {
      token: secret.plaintext,
      userId: user.id.value,
      companyId: user.companyId,
      expiresAt: session.expiresAt,
    };
  }
}
