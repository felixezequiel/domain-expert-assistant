import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Email } from "./Email.ts";

describe("Email (identity)", () => {
  it("accepts a well-formed address and lowercases it", () => {
    assert.equal(new Email("Person@Example.COM").value, "person@example.com");
  });

  it("rejects malformed addresses", () => {
    assert.throws(() => new Email("no-at-sign"), /Invalid email/);
    assert.throws(() => new Email("@example.com"), /Invalid email/);
    assert.throws(() => new Email("person@"), /Invalid email/);
  });

  it("compares equal by normalised value", () => {
    assert.ok(new Email("a@b.com").equals(new Email("A@B.com")));
  });
});
