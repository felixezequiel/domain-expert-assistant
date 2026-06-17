import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DomainError } from "../../../shared/domain/errors/DomainError.ts";
import { LastAdminError, InvalidInvitationError } from "./errors.ts";

describe("identity application errors (ADR-026)", () => {
  it("LastAdminError is a coded DomainError that preserves its 500 status (kind internal)", () => {
    const error = new LastAdminError();

    assert.ok(error instanceof DomainError);
    assert.equal(error.name, "LastAdminError");
    assert.equal(error.code, "identity.lastAdmin");
    assert.equal(error.kind, "internal");
    assert.equal(error.params, undefined);
    assert.equal(error.message, "Operation refused: an organization must keep at least one active admin");
  });

  it("InvalidInvitationError is a coded DomainError that preserves its 400 status (kind validation)", () => {
    const error = new InvalidInvitationError();

    assert.ok(error instanceof DomainError);
    assert.equal(error.name, "InvalidInvitationError");
    assert.equal(error.code, "identity.invalidInvitation");
    assert.equal(error.kind, "validation");
    assert.equal(error.params, undefined);
    assert.equal(error.message, "Invalid or already-used invitation");
  });
});
