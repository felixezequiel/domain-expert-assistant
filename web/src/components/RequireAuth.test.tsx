import type { ReactNode } from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequireAuth } from "./RequireAuth.tsx";
import { AuthContext, type Session } from "../auth/AuthContext.tsx";
import { capabilitiesForRoles } from "../auth/capabilities.ts";

const aSession: Session = {
  user: {
    userId: "u1",
    companyId: "c1",
    email: "ada@acme.com",
    displayName: "Ada Admin",
    roles: ["admin"],
    status: "active",
  },
  capabilities: capabilitiesForRoles(["admin"]),
};

function withAuth(
  value: { session: Session | null; loading: boolean },
  children: ReactNode,
): JSX.Element {
  return (
    <AuthContext.Provider
      value={{
        session: value.session,
        isAuthenticated: value.session !== null,
        loading: value.loading,
        login: async () => undefined,
        logout: async () => undefined,
      }}
    >
      <MemoryRouter initialEntries={["/secret"]}>
        <Routes>
          <Route path="/secret" element={<RequireAuth>{children}</RequireAuth>} />
          <Route path="/login" element={<div>login screen</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe("RequireAuth", () => {
  it("renders children when authenticated", () => {
    render(withAuth({ session: aSession, loading: false }, <div>protected</div>));
    expect(screen.getByText("protected")).toBeInTheDocument();
  });

  it("redirects to /login when unauthenticated", () => {
    render(withAuth({ session: null, loading: false }, <div>protected</div>));
    expect(screen.getByText("login screen")).toBeInTheDocument();
    expect(screen.queryByText("protected")).toBeNull();
  });

  it("waits during the boot probe instead of bouncing to login (finding U3)", () => {
    render(withAuth({ session: null, loading: true }, <div>protected</div>));
    expect(screen.queryByText("login screen")).toBeNull();
    expect(screen.queryByText("protected")).toBeNull();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});
