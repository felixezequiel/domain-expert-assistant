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

describe("ItemReadPage", () => {
  it("renders the heading, markdown body, status badge and a deprecated badge", async () => {
    render(
      <MemoryRouter initialEntries={["/catalog/i1"]}>
        <Routes>
          <Route path="/catalog/:itemId" element={<ItemReadPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Read me" })).toBeInTheDocument());

    expect(screen.getByRole("heading", { name: "Section" })).toBeInTheDocument();
    expect(screen.getByText("body text")).toBeInTheDocument();
    // A deprecated + stale item shows the status badge and the freshness warning badge.
    expect(screen.getAllByText("Deprecated").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });
});
