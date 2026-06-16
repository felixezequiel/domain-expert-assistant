/**
 * Cross-aggregate domain-rule violation (ADR-011): an org must always keep at least one
 * active Admin, so changing roles or disabling the last one is refused. Checked in the
 * use case because it spans all users of the org, not a single aggregate.
 */
export class LastAdminError extends Error {
  constructor() {
    super("Operation refused: an organization must keep at least one active admin");
    this.name = "LastAdminError";
  }
}

/**
 * The invitation token did not resolve to a pending (invited) user.
 */
export class InvalidInvitationError extends Error {
  constructor() {
    super("Invalid or already-used invitation");
    this.name = "InvalidInvitationError";
  }
}
