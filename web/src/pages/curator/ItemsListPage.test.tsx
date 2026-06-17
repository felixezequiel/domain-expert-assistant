import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ItemsListPage } from "./ItemsListPage.tsx";
import { mockFetchSequence, installFetch } from "../../test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ItemsListPage", () => {
  it("lists items, flags stale ones, and links to create a new item", async () => {
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
                lastRejectionReason: null,
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

    expect(screen.getByRole("heading", { name: "Items" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Runbook A")).toBeInTheDocument());
    expect(screen.getByText("stale")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /New item/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/items/i1");
    expect(screen.getByRole("link", { name: "Versions" })).toHaveAttribute(
      "href",
      "/items/i1/versions",
    );
  });

  it("shows an empty state when there are no items", async () => {
    installFetch(
      mockFetchSequence([
        { status: 200, body: { collections: [] } },
        { status: 200, body: { tags: [] } },
        { status: 200, body: { items: [] } },
      ]),
    );

    render(
      <MemoryRouter>
        <ItemsListPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText("No items match these filters.")).toBeInTheDocument(),
    );
  });
});
