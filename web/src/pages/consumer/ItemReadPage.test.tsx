import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("../../api/resources.ts", () => ({
  itemsApi: {
    get: vi.fn(async () => ({
      id: "i1",
      collectionId: "c1",
      title: "Read me",
      body: "## Section\n\nbody text",
      tagIds: [],
      sensitivity: "confidential",
      status: "deprecated",
      currentVersionNumber: 4,
      publishedVersionNumber: 3,
      isServed: true,
      isStale: true,
      lastRejectionReason: null,
    })),
  },
}));

import { ItemReadPage } from "./ItemReadPage.tsx";
import { AuthContext, type Session } from "../../auth/AuthContext.tsx";
import { capabilitiesForRoles } from "../../auth/capabilities.ts";

const consumerSession: Session = {
  user: { userId: "u1", companyId: "c1", email: "c@e2e.test", displayName: "Reader", roles: ["consumer"], status: "active" },
  capabilities: capabilitiesForRoles(["consumer"]),
};

describe("ItemReadPage", () => {
  it("renders the heading, markdown body, status badge and a deprecated badge", async () => {
    render(
      <AuthContext.Provider
        value={{ session: consumerSession, isAuthenticated: true, loading: false, login: async () => undefined, logout: async () => undefined }}
      >
        <MemoryRouter initialEntries={["/catalog/i1"]}>
          <Routes>
            <Route path="/catalog/:itemId" element={<ItemReadPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Read me" })).toBeInTheDocument());

    expect(screen.getByRole("heading", { name: "Section" })).toBeInTheDocument();
    expect(screen.getByText("body text")).toBeInTheDocument();
    // A deprecated + stale item shows the status badge and the freshness warning badge.
    expect(screen.getAllByText("Deprecated").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });
});
