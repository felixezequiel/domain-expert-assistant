import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { Role } from "../../../../shared/domain/Role.ts";
import type {
  UserRepositoryPort,
  OrganizationRepositoryPort,
  OpaqueSecretPort,
} from "../types.ts";
import { OrganizationId } from "../../domain/identifiers/OrganizationId.ts";

/** What the public accept-invitation screen shows so the invitee knows what they're joining. */
export interface InvitationView {
  readonly organizationName: string;
  readonly email: string;
  readonly roles: ReadonlyArray<Role>;
}

/**
 * Describes a pending invitation by its one-time token so the (not-yet-authenticated)
 * invitee sees which organization invited them, the email it was sent to, and the roles
 * they will receive — before choosing a password. Run by the edge in a system scope; the
 * token is itself the bearer secret, so there is no role gate. Returns null for an unknown
 * or already-used token (the screen then shows a generic "invalid invitation").
 */
export class DescribeInvitationUseCase implements UseCase<string, InvitationView | null> {
  private readonly userRepository: UserRepositoryPort;
  private readonly organizationRepository: OrganizationRepositoryPort;
  private readonly opaqueSecret: OpaqueSecretPort;

  constructor(
    userRepository: UserRepositoryPort,
    organizationRepository: OrganizationRepositoryPort,
    opaqueSecret: OpaqueSecretPort,
  ) {
    this.userRepository = userRepository;
    this.organizationRepository = organizationRepository;
    this.opaqueSecret = opaqueSecret;
  }

  public async execute(token: string): Promise<InvitationView | null> {
    const tokenHash = this.opaqueSecret.hash(token);
    const user = await this.userRepository.findByInvitationTokenHash(tokenHash);
    if (user === null || user.status !== "invited") {
      return null;
    }
    const organization = await this.organizationRepository.findById(
      new OrganizationId(user.companyId),
    );
    return {
      organizationName: organization === null ? "" : organization.name.value,
      email: user.email.value,
      roles: [...user.roles],
    };
  }
}
