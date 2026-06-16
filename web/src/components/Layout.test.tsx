import type { ReactNode } from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./Layout.tsx";
import { AuthContext, type Session } from "../auth/AuthContext.tsx";

afterEach(() => {
  vi.restoreAllMocks();
});

function AuthContextStub({
  session,
  children,
}: {
  readonly session: Session | null;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <AuthContext.Provider
      value={{
        session,
        isAuthenticated: session !== null,
        login: async () => undefined,
        logout: async () => undefined,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function renderNav(canAdminister: boolean, canAudit: boolean): void {
  render(
    <AuthContextStub
      session={{
        userId: "u1",
        companyId: "c1",
        expiresAt: "2030-01-01T00:00:00.000Z",
        capabilities: { canAdminister, canAudit },
      }}
    >
      <MemoryRouter initialEntries={["/search"]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/search" element={<div>search content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContextStub>,
  );
}

describe("Layout role-gated nav", () => {
  it("always shows the open sections (search, items, review)", () => {
    renderNav(false, false);
    expect(screen.getByRole("link", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Items" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review queue" })).toBeInTheDocument();
  });

  it("hides admin + audit nav when those capabilities are absent", () => {
    renderNav(false, false);
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Credentials" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Audit trail" })).not.toBeInTheDocument();
  });

  it("shows admin nav when canAdminister and audit nav when canAudit", () => {
    renderNav(true, true);
    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Collections" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Credentials" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Org policy" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Audit trail" })).toBeInTheDocument();
  });
});
