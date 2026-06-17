import { DomainError } from "../../../shared/domain/errors/DomainError.ts";

/**
 * Cross-aggregate domain-rule violation (ADR-011): an org must always keep at least one
 * active Admin, so changing roles or disabling the last one is refused. Checked in the
 * use case because it spans all users of the org, not a single aggregate.
 *
 * Carries a stable code for the SPA (ADR-026). The message currently maps to a 500 at the
 * edge (no substring match in the old `statusForError`), so `kind: "internal"` preserves
 * that status — this ADR migrates codes, not statuses.
 */
export class LastAdminError extends DomainError {
  constructor() {
    super(
      "identity.lastAdmin",
      "internal",
      undefined,
      "Operation refused: an organization must keep at least one active admin",
    );
    this.name = "LastAdminError";
  }
}

/**
 * The invitation token did not resolve to a pending (invited) user.
 *
 * The message matches both "Invalid" and "already" in the old `statusForError`, mapping to
 * a 400, so `kind: "validation"` preserves that status (ADR-026).
 */
export class InvalidInvitationError extends DomainError {
  constructor() {
    super("identity.invalidInvitation", "validation", undefined, "Invalid or already-used invitation");
    this.name = "InvalidInvitationError";
  }
}
