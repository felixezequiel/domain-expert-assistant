import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ReviewDetailPage } from "./ReviewDetailPage.tsx";
import { mockFetchSequence, installFetch } from "../../test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

const itemBody = {
  id: "i1",
  collectionId: "c1",
  title: "Needs review",
  body: "# Heading\n\ncontent",
  tagIds: [],
  sensitivity: "internal",
  status: "in_review",
  currentVersionNumber: 2,
  publishedVersionNumber: null,
  isServed: false,
  isStale: false,
};

function renderDetail(): void {
  render(
    <MemoryRouter initialEntries={["/review/i1"]}>
      <Routes>
        <Route path="/review/:itemId" element={<ReviewDetailPage />} />
        <Route path="/review" element={<div>queue</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ReviewDetailPage", () => {
  it("renders the item body and approves it", async () => {
    const fetchFn = mockFetchSequence([
      { status: 200, body: itemBody },
      { status: 200, body: { id: "i1", status: "published" } }, // approve
      { status: 200, body: { ...itemBody, status: "published" } }, // reload
    ]);
    installFetch(fetchFn);
    renderDetail();

    await waitFor(() => expect(screen.getByText("Needs review")).toBeInTheDocument());
    expect(screen.getByRole("heading", { level: 1, name: "Heading" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(screen.getByText(/Approved/i)).toBeInTheDocument());
    expect(fetchFn.mock.calls.find(([url]) => url === "/items/i1/approve")).toBeDefined();
  });

  it("rejects with a reason", async () => {
    const fetchFn = mockFetchSequence([
      { status: 200, body: itemBody },
      { status: 200, body: { id: "i1", status: "draft" } }, // reject
      { status: 200, body: { ...itemBody, status: "draft" } }, // reload
    ]);
    installFetch(fetchFn);
    renderDetail();

    await waitFor(() => expect(screen.getByText("Needs review")).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText("Rejection reason"), "needs more detail");
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => expect(screen.getByText(/Rejected/i)).toBeInTheDocument());
    const rejectCall = fetchFn.mock.calls.find(([url]) => url === "/items/i1/reject");
    expect((rejectCall?.[1] as RequestInit).body).toBe(JSON.stringify({ reason: "needs more detail" }));
  });
});
