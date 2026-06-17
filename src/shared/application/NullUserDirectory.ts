import type { UserDirectoryPort } from "../ports/UserDirectoryPort.ts";

/**
 * A UserDirectoryPort that resolves nothing — every id falls back to itself. Wired where a
 * consumer reuses a name-bearing read query purely for its content and never renders the
 * names (e.g. the Retrieval projection re-reads version history for body text only), so it
 * carries no dependency on the Identity context.
 */
export class NullUserDirectory implements UserDirectoryPort {
  public async resolveDisplayNames(
    _userIds: ReadonlyArray<string>,
  ): Promise<ReadonlyMap<string, string>> {
    return new Map();
  }
}
