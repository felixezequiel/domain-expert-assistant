import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NullUserDirectory } from "./NullUserDirectory.ts";

describe("NullUserDirectory", () => {
  it("resolves no names, so every id falls back to itself", async () => {
    const directory = new NullUserDirectory();

    const names = await directory.resolveDisplayNames(["user-1", "user-2"]);

    assert.equal(names.size, 0);
  });
});
