import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { IssueConsumerCredentialCommand } from "./IssueConsumerCredentialCommand.ts";

describe("IssueConsumerCredentialCommand", () => {
  it("builds id, name and scope", () => {
    const command = IssueConsumerCredentialCommand.of("cred-1", "  Bot  ", ["col-1", "col-2"], "internal");

    assert.equal(command.credentialId.value, "cred-1");
    assert.equal(command.name, "Bot");
    assert.deepEqual([...command.scope.collectionIds], ["col-1", "col-2"]);
    assert.equal(command.scope.sensitivityCeiling.name, "internal");
  });

  it("rejects an empty name", () => {
    assert.throws(() => IssueConsumerCredentialCommand.of("cred-1", "  ", [], "public"), /name is required/);
  });

  it("rejects an unknown sensitivity ceiling", () => {
    assert.throws(() => IssueConsumerCredentialCommand.of("cred-1", "Bot", [], "secret"), /Unknown sensitivity/);
  });
});
