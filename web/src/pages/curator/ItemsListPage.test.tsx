import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ItemsListPage } from "./ItemsListPage.tsx";
import { mockFetchSequence, installFetch } from "../../test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ItemsListPage", () => {
  it("lists items and flags stale ones", async () => {
    installFetch(
      mockFetchSequence([
        { status: 200, body: { collections: [] } },
        { status: 200, body: { tags: [] } },
        {
          status: 200,
          body: {
            items: [
              {
                id: "i1",
                collectionId: "c1",
                title: "Runbook A",
                body: "x",
                tagIds: [],
                sensitivity: "internal",
                status: "published",
                currentVersionNumber: 3,
                publishedVersionNumber: 3,
                isServed: true,
                isStale: true,
              },
            ],
          },
        },
      ]),
    );

    render(
      <MemoryRouter>
        <ItemsListPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("Runbook A")).toBeInTheDocument());
    expect(screen.getByText("stale")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New item" })).toBeInTheDocument();
  });
});
