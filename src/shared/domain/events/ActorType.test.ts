import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ActorType } from "./ActorType.ts";

describe("ActorType", () => {
  it("admits exactly the four actor kinds", () => {
    const allTypes: ReadonlyArray<ActorType> = ["user", "consumer", "system", "operator"];

    assert.deepEqual([...allTypes], ["user", "consumer", "system", "operator"]);
  });
});
