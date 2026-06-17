import type { ReactNode } from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RequireCapability } from "./RequireCapability.tsx";
import { AuthContext, type Session } from "../auth/AuthContext.tsx";
import { capabilitiesForRoles } from "../auth/capabilities.ts";
import type { Role } from "../api/types.ts";

function withRoles(roles: ReadonlyArray<Role>, children: ReactNode): void {
  const session: Session = {
    user: { userId: "u", companyId: "c", email: "e@x.com", displayName: "U", roles, status: "active" },
    capabilities: capabilitiesForRoles(roles),
  };
  render(
    <AuthContext.Provider
      value={{
        session,
        isAuthenticated: true,
        loading: false,
        login: async () => undefined,
        logout: async () => undefined,
      }}
    >
      {children}
    </AuthContext.Provider>,
  );
}

describe("RequireCapability", () => {
  it("renders children when the capability is present", () => {
    withRoles(["admin"], <RequireCapability capability="canAdminister"><div>secret area</div></RequireCapability>);
    expect(screen.getByText("secret area")).toBeInTheDocument();
  });

  it("shows a Not permitted page when the capability is absent", () => {
    withRoles(["curator"], <RequireCapability capability="canAdminister"><div>secret area</div></RequireCapability>);
    expect(screen.getByText("Not permitted")).toBeInTheDocument();
    expect(screen.queryByText("secret area")).toBeNull();
  });
});
