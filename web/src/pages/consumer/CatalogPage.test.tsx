import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { listMock } = vi.hoisted(() => ({
  listMock: vi.fn(async (_collectionId?: string, status?: string) => {
    if (status === "published") {
      return {
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
            lastRejectionReason: null,
          },
        ],
      };
    }
    return {
      items: [
        {
          id: "i2",
          collectionId: "c1",
          title: "Old doc",
          body: "y",
          tagIds: [],
          sensitivity: "internal",
          status: "deprecated",
          currentVersionNumber: 5,
          publishedVersionNumber: 4,
          isServed: true,
          isStale: true,
          lastRejectionReason: null,
        },
      ],
    };
  }),
}));

vi.mock("../../api/resources.ts", () => ({
  collectionsApi: {
    list: vi.fn(async () => ({ collections: [{ id: "c1", name: "Handbook", description: null, createdBy: "u1" }] })),
  },
  tagsApi: {
    list: vi.fn(async () => ({ tags: [] })),
  },
  itemsApi: {
    list: listMock,
  },
}));

import { CatalogPage } from "./CatalogPage.tsx";

describe("CatalogPage", () => {
  it("renders the heading and merges published + deprecated items with a collection name", async () => {
    render(
      <MemoryRouter>
        <CatalogPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Catalog" })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Public doc")).toBeInTheDocument());
    // Both published and deprecated items are served by search, so both must be browsable (S3).
    expect(screen.getByText("Old doc")).toBeInTheDocument();
    expect(screen.getAllByText("Deprecated").length).toBeGreaterThan(0);
    // Collection NAME, not the raw UUID.
    expect(screen.getAllByText(/Handbook/).length).toBeGreaterThan(0);

    const statuses = listMock.mock.calls.map((call) => call[1]);
    expect(statuses).toContain("published");
    expect(statuses).toContain("deprecated");
  });
});
