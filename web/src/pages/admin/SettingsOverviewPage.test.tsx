import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../api/resources.ts", () => ({
  usersApi: {
    list: vi.fn(async () => ({
      users: [
        { id: "u1", email: "a@x", displayName: "Ada", roles: ["admin"], status: "active" },
        { id: "u2", email: "c@x", displayName: "Carl", roles: ["curator"], status: "active" },
      ],
    })),
    getPolicy: vi.fn(async () => ({ organizationId: "c1", requireSeparateReviewer: true })),
  },
  collectionsApi: { list: vi.fn(async () => ({ collections: [{ id: "c1", name: "Docs", description: null, createdBy: "u1" }] })) },
  tagsApi: { list: vi.fn(async () => ({ tags: [] })) },
  credentialsApi: {
    list: vi.fn(async () => ({
      credentials: [
        { id: "k1", name: "K", keyPrefix: "p", collectionIds: [], sensitivityCeiling: "internal", status: "active", createdAt: "", lastUsedAt: null },
        { id: "k2", name: "R", keyPrefix: "q", collectionIds: [], sensitivityCeiling: "internal", status: "revoked", createdAt: "", lastUsedAt: null },
      ],
    })),
  },
}));

import { SettingsOverviewPage } from "./SettingsOverviewPage.tsx";
import { AuthContext, type Session } from "../../auth/AuthContext.tsx";
import { capabilitiesForRoles } from "../../auth/capabilities.ts";

const adminSession: Session = {
  user: { userId: "u1", companyId: "c1", email: "ada@x", displayName: "Ada", roles: ["admin"], status: "active" },
  capabilities: capabilitiesForRoles(["admin"]),
};

function renderOverview(): void {
  render(
    <AuthContext.Provider
      value={{ session: adminSession, isAuthenticated: true, loading: false, login: async () => undefined, logout: async () => undefined }}
    >
      <MemoryRouter>
        <SettingsOverviewPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("SettingsOverviewPage", () => {
  it("shows the governance posture, role legend and sensitivity ladder", async () => {
    renderOverview();

    // Separation-of-duties posture reflects the live policy (requireSeparateReviewer: true).
    await waitFor(() => expect(screen.getByText("On")).toBeInTheDocument());
    expect(screen.getByText("Separation of duties")).toBeInTheDocument();

    // Role legend explains what each role can do.
    expect(screen.getByText("Roles & what they can do")).toBeInTheDocument();
    expect(screen.getByText(/Creates and edits knowledge items/)).toBeInTheDocument();

    // Sensitivity ladder is documented.
    expect(screen.getByText("Sensitivity levels")).toBeInTheDocument();
  });

  it("counts only active credentials in the metric", async () => {
    renderOverview();
    // Two credentials seeded (one active, one revoked) → the metric card shows 1.
    const credentialsCard = await screen.findByRole("link", { name: /Active credentials/ });
    expect(credentialsCard).toHaveTextContent("1");
  });
});
