import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { Role } from "../../../../shared/domain/Role.ts";
import type { UserRepositoryPort } from "../types.ts";
import { UserId } from "../../domain/identifiers/UserId.ts";
import { getCurrentActor } from "../../../../shared/application/context/ActorContext.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

/** "Who am I" for the authenticated session — id, name, email, roles and status. */
export interface CurrentUserView {
  readonly userId: string;
  readonly companyId: string;
  readonly email: string;
  readonly displayName: string;
  readonly roles: ReadonlyArray<Role>;
  readonly status: string;
}

/**
 * Describes the currently authenticated principal. No role gate — any signed-in user may
 * read their own identity. This lets the SPA restore its session on a hard refresh (the
 * httpOnly cookie outlives the in-memory state) and show the user's name + roles instead of
 * a raw id. Authoritative authorization for every other action remains server-side (ADR-011).
 */
export class DescribeCurrentUserUseCase implements UseCase<void, CurrentUserView> {
  private readonly userRepository: UserRepositoryPort;

  constructor(userRepository: UserRepositoryPort) {
    this.userRepository = userRepository;
  }

  public async execute(): Promise<CurrentUserView> {
    const actorId = getCurrentActor()?.actorId ?? null;
    if (actorId === null) {
      throw new DomainError(
        "identity.describeCurrentUserWithoutActor",
        "internal",
        undefined,
        "Cannot describe the current user without an actor in the context",
      );
    }

    const user = await this.userRepository.findById(new UserId(actorId));
    if (user === null) {
      throw new DomainError(
        "identity.currentUserNotFound",
        "validation",
        { id: actorId },
        "Current user not found: " + actorId,
      );
    }

    return {
      userId: user.id.value,
      companyId: user.companyId,
      email: user.email.value,
      displayName: user.displayName.value,
      roles: [...user.roles],
      status: user.status,
    };
  }
}
