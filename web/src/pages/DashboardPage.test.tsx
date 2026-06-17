import type { ReactNode } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../api/resources.ts", () => ({
  itemsApi: {
    list: vi.fn().mockResolvedValue({
      items: [
        item("1", "published", null),
        item("2", "draft", "Needs sources before publishing"),
      ],
    }),
  },
  usersApi: { list: vi.fn() },
  collectionsApi: { list: vi.fn() },
  credentialsApi: { list: vi.fn() },
}));

import { DashboardPage } from "./DashboardPage.tsx";
import { AuthContext, type Session } from "../auth/AuthContext.tsx";
import { capabilitiesForRoles } from "../auth/capabilities.ts";
import type { Role } from "../api/types.ts";

function item(id: string, status: string, lastRejectionReason: string | null) {
  return {
    id,
    collectionId: "c1",
    title: status === "draft" ? "Draft needing work" : "A published item",
    body: "",
    tagIds: [],
    sensitivity: "internal",
    status,
    currentVersionNumber: 1,
    publishedVersionNumber: status === "published" ? 1 : null,
    isServed: status === "published",
    isStale: false,
    lastRejectionReason,
  };
}

function renderDashboard(roles: ReadonlyArray<Role>, children: ReactNode = <DashboardPage />): void {
  const session: Session = {
    user: { userId: "u1", companyId: "c1", email: "carl@e2e.test", displayName: "Carl Curator", roles, status: "active" },
    capabilities: capabilitiesForRoles(roles),
  };
  render(
    <AuthContext.Provider
      value={{ session, isAuthenticated: true, loading: false, login: async () => undefined, logout: async () => undefined }}
    >
      <MemoryRouter>{children}</MemoryRouter>
    </AuthContext.Provider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("DashboardPage", () => {
  it("greets the user by first name and surfaces curator actions + a drafts metric", async () => {
    renderDashboard(["curator"]);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Carl");
    expect(screen.getByRole("link", { name: /New item/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Drafts")).toBeInTheDocument());
  });

  it("lists rejected drafts under 'Needs your attention' with the reason", async () => {
    renderDashboard(["curator"]);

    await waitFor(() => expect(screen.getByText("Needs your attention")).toBeInTheDocument());
    expect(screen.getByText(/Needs sources before publishing/)).toBeInTheDocument();
  });
});
