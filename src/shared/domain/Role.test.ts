import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ROLES, isRole, parseRole } from "./Role.ts";

describe("Role", () => {
  it("defines the five additive roles", () => {
    assert.deepEqual([...ROLES], ["admin", "curator", "reviewer", "auditor", "consumer"]);
  });

  it("recognises valid role names", () => {
    assert.equal(isRole("admin"), true);
    assert.equal(isRole("curator"), true);
  });

  it("rejects unknown role names", () => {
    assert.equal(isRole("superuser"), false);
    assert.equal(isRole(""), false);
  });

  it("parses a valid role", () => {
    assert.equal(parseRole("reviewer"), "reviewer");
  });

  it("throws when parsing an unknown role", () => {
    assert.throws(() => parseRole("root"), /Unknown role: root/);
  });
});
