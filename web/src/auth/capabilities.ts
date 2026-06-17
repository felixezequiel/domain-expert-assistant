import type { Role } from "../api/types.ts";

// Capabilities are a UX hint only — they tailor nav and screen affordances. The server's
// authorization (ADR-011) remains the sole authoritative gate; a hidden link is never a
// security boundary. Derived from the roles the session actually holds (GET /auth/me), which
// is exact — unlike the old approach that probed role-gated endpoints and logged 403s.
export interface Capabilities {
  readonly canAdminister: boolean;
  readonly canAudit: boolean;
  readonly canCurate: boolean;
  readonly canReview: boolean;
}

export const NO_CAPABILITIES: Capabilities = {
  canAdminister: false,
  canAudit: false,
  canCurate: false,
  canReview: false,
};

export function capabilitiesForRoles(roles: ReadonlyArray<Role>): Capabilities {
  const isAdmin = roles.includes("admin");
  return {
    canAdminister: isAdmin,
    canAudit: isAdmin || roles.includes("auditor"),
    canCurate: isAdmin || roles.includes("curator"),
    canReview: isAdmin || roles.includes("reviewer"),
  };
}
