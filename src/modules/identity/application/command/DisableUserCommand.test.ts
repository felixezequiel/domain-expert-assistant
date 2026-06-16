import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DisableUserCommand } from "./DisableUserCommand.ts";

describe("DisableUserCommand", () => {
  it("wraps the user id", () => {
    assert.equal(DisableUserCommand.of("u1").userId.value, "u1");
  });
});
