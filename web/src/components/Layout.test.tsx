import type { ReactNode } from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./Layout.tsx";
import { AuthContext, type Session } from "../auth/AuthContext.tsx";
import { capabilitiesForRoles } from "../auth/capabilities.ts";
import type { Role } from "../api/types.ts";

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
        loading: false,
        login: async () => undefined,
        logout: async () => undefined,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function renderNavForRoles(roles: ReadonlyArray<Role>): void {
  const session: Session = {
    user: {
      userId: "u1",
      companyId: "c1",
      email: "person@acme.com",
      displayName: "Test Person",
      roles,
      status: "active",
    },
    capabilities: capabilitiesForRoles(roles),
  };
  render(
    <AuthContextStub session={session}>
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

describe("Layout role-tailored nav", () => {
  it("always shows Search and Catalog", () => {
    renderNavForRoles(["consumer"]);
    expect(screen.getByRole("link", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Catalog" })).toBeInTheDocument();
  });

  it("hides curation/admin/audit nav for a consumer-only session", () => {
    renderNavForRoles(["consumer"]);
    expect(screen.queryByRole("link", { name: "Items" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Review queue" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Audit trail" })).not.toBeInTheDocument();
  });

  it("shows Items/Upload for a curator and Review queue for a reviewer", () => {
    renderNavForRoles(["curator"]);
    expect(screen.getByRole("link", { name: "Items" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Upload" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Review queue" })).not.toBeInTheDocument();
  });

  it("shows a single consolidated Settings entry + Audit trail for an admin", () => {
    renderNavForRoles(["admin"]);
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Audit trail" })).toBeInTheDocument();
    // The five loose admin links are gone — they live as tabs inside Settings now.
    expect(screen.queryByRole("link", { name: "Collections" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Org policy" })).not.toBeInTheDocument();
  });
});
