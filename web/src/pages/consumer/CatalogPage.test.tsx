import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CatalogPage } from "./CatalogPage.tsx";
import { mockFetchSequence, installFetch } from "../../test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CatalogPage", () => {
  it("lists published items and requests the published filter", async () => {
    const fetchFn = mockFetchSequence([
      { status: 200, body: { collections: [] } },
      { status: 200, body: { tags: [] } },
      {
        status: 200,
        body: {
          items: [
            {
              id: "i1",
              collectionId: "c1",
              title: "Public doc",
              body: "x",
              tagIds: [],
              sensitivity: "public",
              status: "published",
              currentVersionNumber: 2,
              publishedVersionNumber: 2,
              isServed: true,
              isStale: false,
            },
          ],
        },
      },
    ]);
    installFetch(fetchFn);

    render(
      <MemoryRouter>
        <CatalogPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("Public doc")).toBeInTheDocument());
    const itemsCall = fetchFn.mock.calls.find(([url]) => String(url).startsWith("/items"));
    expect(itemsCall?.[0]).toBe("/items?status=published");
  });
});
