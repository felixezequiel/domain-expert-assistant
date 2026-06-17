import { describe, it, expect } from "vitest";
import { capabilitiesForRoles, NO_CAPABILITIES } from "./capabilities.ts";

describe("capabilitiesForRoles", () => {
  it("grants every capability to an admin", () => {
    expect(capabilitiesForRoles(["admin"])).toEqual({
      canAdminister: true,
      canAudit: true,
      canCurate: true,
      canReview: true,
    });
  });

  it("maps each non-admin role to exactly its capability", () => {
    expect(capabilitiesForRoles(["curator"])).toEqual({
      canAdminister: false,
      canAudit: false,
      canCurate: true,
      canReview: false,
    });
    expect(capabilitiesForRoles(["reviewer"])).toEqual({
      canAdminister: false,
      canAudit: false,
      canCurate: false,
      canReview: true,
    });
    expect(capabilitiesForRoles(["auditor"])).toEqual({
      canAdminister: false,
      canAudit: true,
      canCurate: false,
      canReview: false,
    });
  });

  it("grants nothing to a consumer-only session", () => {
    expect(capabilitiesForRoles(["consumer"])).toEqual(NO_CAPABILITIES);
  });
});
