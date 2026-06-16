import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SessionId } from "./SessionId.ts";

describe("SessionId", () => {
  it("wraps a value and compares equal by value", () => {
    assert.equal(new SessionId("sess-1").value, "sess-1");
    assert.ok(new SessionId("sess-1").equals(new SessionId("sess-1")));
  });
});
