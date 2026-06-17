import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { KnowledgeItemView } from "../../api/types.ts";

const list = vi.fn();

vi.mock("../../api/resources.ts", () => ({
  itemsApi: { list: (...args: ReadonlyArray<unknown>) => list(...args) },
}));

import { ReviewQueuePage } from "./ReviewQueuePage.tsx";

const queuedItem: KnowledgeItemView = {
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
  lastRejectionReason: null,
};

beforeEach(() => {
  list.mockReset();
});

describe("ReviewQueuePage", () => {
  it("lists in_review items and queries the in_review filter", async () => {
    list.mockResolvedValue({ items: [queuedItem] });

    render(
      <MemoryRouter>
        <ReviewQueuePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Review queue" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Pending item")).toBeInTheDocument());
    expect(list).toHaveBeenCalledWith(undefined, "in_review");
    expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute("href", "/review/i1");
  });

  it("shows an empty state when nothing awaits review", async () => {
    list.mockResolvedValue({ items: [] });

    render(
      <MemoryRouter>
        <ReviewQueuePage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText(/Nothing waiting for review/i)).toBeInTheDocument());
  });
});
