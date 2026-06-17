import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { UserDirectoryPort } from "./UserDirectoryPort.ts";

describe("UserDirectoryPort", () => {
  it("defines a contract for resolving user ids to display names", () => {
    const fakeDirectory: UserDirectoryPort = {
      resolveDisplayNames: async () => new Map(),
    };

    assert.equal(typeof fakeDirectory.resolveDisplayNames, "function");
  });

  it("returns a map keyed by the resolved user ids; unresolved ids are absent", async () => {
    const fakeDirectory: UserDirectoryPort = {
      resolveDisplayNames: async (userIds: ReadonlyArray<string>): Promise<ReadonlyMap<string, string>> => {
        const known = new Map([["user-1", "Ada Lovelace"]]);
        const resolved = new Map<string, string>();
        for (const userId of userIds) {
          const name = known.get(userId);
          if (name !== undefined) {
            resolved.set(userId, name);
          }
        }
        return resolved;
      },
    };

    const names = await fakeDirectory.resolveDisplayNames(["user-1", "user-missing"]);

    assert.equal(names.get("user-1"), "Ada Lovelace");
    assert.equal(names.has("user-missing"), false);
  });
});
