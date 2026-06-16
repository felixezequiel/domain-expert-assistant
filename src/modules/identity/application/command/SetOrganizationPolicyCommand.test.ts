import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SetOrganizationPolicyCommand } from "./SetOrganizationPolicyCommand.ts";

describe("SetOrganizationPolicyCommand", () => {
  it("carries the policy flag", () => {
    assert.equal(SetOrganizationPolicyCommand.of(false).requireSeparateReviewer, false);
    assert.equal(SetOrganizationPolicyCommand.of(true).requireSeparateReviewer, true);
  });
});
