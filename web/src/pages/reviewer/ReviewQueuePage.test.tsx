import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ReviewQueuePage } from "./ReviewQueuePage.tsx";
import { mockFetchSequence, installFetch } from "../../test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ReviewQueuePage", () => {
  it("lists in_review items and requests the in_review filter", async () => {
    const fetchFn = mockFetchSequence([
      {
        status: 200,
        body: {
          items: [
            {
              id: "i1",
              collectionId: "c1",
              title: "Pending item",
              body: "x",
              tagIds: [],
              sensitivity: "internal",
              status: "in_review",
              currentVersionNumber: 2,
              publishedVersionNumber: null,
              isServed: false,
              isStale: false,
            },
          ],
        },
      },
    ]);
    installFetch(fetchFn);

    render(
      <MemoryRouter>
        <ReviewQueuePage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("Pending item")).toBeInTheDocument());
    expect(fetchFn.mock.calls[0]![0]).toBe("/items?status=in_review");
  });

  it("shows an empty notice when nothing awaits review", async () => {
    installFetch(mockFetchSequence([{ status: 200, body: { items: [] } }]));
    render(
      <MemoryRouter>
        <ReviewQueuePage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/Nothing awaiting review/i)).toBeInTheDocument());
  });
});
