import type { ReactNode } from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequireAuth } from "./RequireAuth.tsx";
import { AuthContext, type Session } from "../auth/AuthContext.tsx";

function withSession(session: Session | null, children: ReactNode): JSX.Element {
  return (
    <AuthContext.Provider
      value={{ session, isAuthenticated: session !== null, login: async () => undefined, logout: async () => undefined }}
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

const aSession: Session = {
  userId: "u1",
  companyId: "c1",
  expiresAt: "2030-01-01T00:00:00.000Z",
  capabilities: { canAdminister: false, canAudit: false },
};

describe("RequireAuth", () => {
  it("renders children when authenticated", () => {
    render(withSession(aSession, <div>protected</div>));
    expect(screen.getByText("protected")).toBeInTheDocument();
  });

  it("redirects to /login when unauthenticated", () => {
    render(withSession(null, <div>protected</div>));
    expect(screen.getByText("login screen")).toBeInTheDocument();
    expect(screen.queryByText("protected")).toBeNull();
  });
});
