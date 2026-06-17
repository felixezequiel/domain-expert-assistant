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

  it("surfaces rejected drafts in a 'needs attention' callout above the table", async () => {
    installFetch(
      mockFetchSequence([
        { status: 200, body: { collections: [] } },
        { status: 200, body: { tags: [] } },
        // table query (status filter) — an unrelated published item
        {
          status: 200,
          body: {
            items: [
              {
                id: "p1",
                collectionId: "c1",
                title: "Published doc",
                body: "x",
                tagIds: [],
                sensitivity: "internal",
                status: "published",
                currentVersionNumber: 2,
                publishedVersionNumber: 2,
                isServed: true,
                isStale: false,
                lastRejectionReason: null,
              },
            ],
          },
        },
        // attention query (drafts) — a rejected draft that must not get lost in the table
        {
          status: 200,
          body: {
            items: [
              {
                id: "d1",
                collectionId: "c1",
                title: "Pricing guide",
                body: "x",
                tagIds: [],
                sensitivity: "internal",
                status: "draft",
                currentVersionNumber: 3,
                publishedVersionNumber: null,
                isServed: false,
                isStale: false,
                lastRejectionReason: "Missing tax section",
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

    await waitFor(() => expect(screen.getByText("Needs your attention")).toBeInTheDocument());
    expect(screen.getByText("Pricing guide")).toBeInTheDocument();
    expect(screen.getByText("Rejected: Missing tax section")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pricing guide/ })).toHaveAttribute("href", "/items/d1");
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
