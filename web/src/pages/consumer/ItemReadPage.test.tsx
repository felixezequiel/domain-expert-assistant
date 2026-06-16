import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ItemReadPage } from "./ItemReadPage.tsx";
import { mockFetchSequence, installFetch } from "../../test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ItemReadPage", () => {
  it("renders the markdown body with attribution and a stale badge", async () => {
    installFetch(
      mockFetchSequence([
        {
          status: 200,
          body: {
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
          },
        },
      ]),
    );

    render(
      <MemoryRouter initialEntries={["/catalog/i1"]}>
        <Routes>
          <Route path="/catalog/:itemId" element={<ItemReadPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole("heading", { level: 2, name: "Read me" })).toBeInTheDocument());
    expect(screen.getByRole("heading", { level: 2, name: "Section" })).toBeInTheDocument();
    expect(screen.getByText("body text")).toBeInTheDocument();
    expect(screen.getByText("stale")).toBeInTheDocument();
  });
});
