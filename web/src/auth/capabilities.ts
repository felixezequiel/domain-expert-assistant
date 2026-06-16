import { apiClient } from "../api/apiClient.ts";
import { ApiError } from "../api/ApiError.ts";

// The login response does NOT carry the user's roles, and the backend is frozen
// (ADR-023 — no new endpoints). So instead of trusting a role list, we probe a few
// role-gated read endpoints right after login and derive *capabilities* from which
// ones succeed vs. 403. This is purely a UX hint for nav visibility; the server's
// authorization (ADR-011) remains the only real gate — every action still surfaces a
// 403 as "not permitted" if the probe guessed wrong.
export interface Capabilities {
  // GET /credentials is admin-gated -> a 200 means the session can administer the org.
  readonly canAdminister: boolean;
  // GET /audit/events is auditor/admin-gated -> a 200 means the session can audit.
  readonly canAudit: boolean;
}

export const NO_CAPABILITIES: Capabilities = {
  canAdminister: false,
  canAudit: false,
};

async function probe(run: () => Promise<unknown>): Promise<boolean> {
  try {
    await run();
    return true;
  } catch (error) {
    if (error instanceof ApiError && (error.isForbidden || error.isUnauthorized)) {
      return false;
    }
    // A non-authorization failure (e.g. 500) should not silently hide nav; treat the
    // capability as available and let the screen surface the real error.
    return true;
  }
}

export async function probeCapabilities(): Promise<Capabilities> {
  const [canAdminister, canAudit] = await Promise.all([
    probe(() => apiClient.get("/credentials")),
    probe(() => apiClient.get("/audit/events", { limit: 1 })),
  ]);
  return { canAdminister, canAudit };
}
