import type { UseCase } from "../../../../shared/application/UseCase.ts";
import type { Role } from "../../../../shared/domain/Role.ts";
import type { UserRepositoryPort } from "../types.ts";
import { getCurrentActor } from "../../../../shared/application/context/ActorContext.ts";
import { DomainError } from "../../../../shared/domain/errors/DomainError.ts";

/** A user row for the admin roster — never includes the password hash. */
export interface OrgUserView {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly roles: ReadonlyArray<Role>;
  readonly status: string;
}

/**
 * Admin lists their organization's users so the console can show a roster and pick targets
 * for "change roles"/"disable" instead of asking the admin to paste a raw user id.
 */
export class ListOrgUsersUseCase implements UseCase<void, ReadonlyArray<OrgUserView>> {
  public readonly requiredRoles: ReadonlyArray<Role> = ["admin"];

  private readonly userRepository: UserRepositoryPort;

  constructor(userRepository: UserRepositoryPort) {
    this.userRepository = userRepository;
  }

  public async execute(): Promise<ReadonlyArray<OrgUserView>> {
    const companyId = getCurrentActor()?.companyId ?? null;
    if (companyId === null) {
      throw new DomainError(
        "identity.listUsersWithoutTenant",
        "internal",
        undefined,
        "Cannot list users without a tenant in the context",
      );
    }

    const users = await this.userRepository.listByCompany(companyId);
    const views: Array<OrgUserView> = [];
    for (const user of users) {
      views.push({
        id: user.id.value,
        email: user.email.value,
        displayName: user.displayName.value,
        roles: [...user.roles],
        status: user.status,
      });
    }
    return views;
  }
}
