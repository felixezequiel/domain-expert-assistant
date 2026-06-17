import type { UserDirectoryPort } from "../../../../shared/ports/UserDirectoryPort.ts";
import type { UserRepositoryPort } from "../../application/types.ts";
import { getCurrentActor } from "../../../../shared/application/context/ActorContext.ts";

/**
 * Cross-module adapter: Identity owns the user table, so it provides the directory that
 * Knowledge (version authors) and Audit (event actors) use to turn user ids into display
 * names. Resolution is tenant-scoped from the Actor Context — only names within the caller's
 * own organization are returned; with no tenant (privileged/system reads) it resolves
 * nothing. The dependency points Identity → the shared port, never the reverse.
 */
export class UserDirectoryAdapter implements UserDirectoryPort {
  private readonly userRepository: UserRepositoryPort;

  constructor(userRepository: UserRepositoryPort) {
    this.userRepository = userRepository;
  }

  public async resolveDisplayNames(
    userIds: ReadonlyArray<string>,
  ): Promise<ReadonlyMap<string, string>> {
    const companyId = getCurrentActor()?.companyId ?? null;
    const names = new Map<string, string>();
    if (companyId === null || userIds.length === 0) {
      return names;
    }
    const wanted = new Set(userIds);
    const users = await this.userRepository.listByCompany(companyId);
    for (const user of users) {
      if (wanted.has(user.id.value)) {
        names.set(user.id.value, user.displayName.value);
      }
    }
    return names;
  }
}
