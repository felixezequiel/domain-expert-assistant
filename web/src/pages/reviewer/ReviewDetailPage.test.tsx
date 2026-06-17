import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { KnowledgeItemView } from "../../api/types.ts";

const get = vi.fn();
const approve = vi.fn();
const reject = vi.fn();
const deprecate = vi.fn();
const archive = vi.fn();

vi.mock("../../api/resources.ts", () => ({
  itemsApi: {
    get: (...args: ReadonlyArray<unknown>) => get(...args),
    approve: (...args: ReadonlyArray<unknown>) => approve(...args),
    reject: (...args: ReadonlyArray<unknown>) => reject(...args),
    deprecate: (...args: ReadonlyArray<unknown>) => deprecate(...args),
    archive: (...args: ReadonlyArray<unknown>) => archive(...args),
  },
}));

import { ReviewDetailPage } from "./ReviewDetailPage.tsx";

const itemBody: KnowledgeItemView = {
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
  lastRejectionReason: null,
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

beforeEach(() => {
  get.mockReset();
  approve.mockReset();
  reject.mockReset();
  deprecate.mockReset();
  archive.mockReset();
});

describe("ReviewDetailPage", () => {
  it("renders the item and approves it", async () => {
    get.mockResolvedValue(itemBody);
    approve.mockResolvedValue({ id: "i1", status: "published" });
    renderDetail();

    expect(screen.getByRole("heading", { level: 1, name: "Review item" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Needs review")).toBeInTheDocument());
    // body rendered as markdown
    expect(screen.getByRole("heading", { level: 1, name: "Heading" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith("i1"));
  });

  it("disables Reject until a reason is typed (U17)", async () => {
    get.mockResolvedValue(itemBody);
    reject.mockResolvedValue({ id: "i1", status: "draft" });
    renderDetail();

    await waitFor(() => expect(screen.getByText("Needs review")).toBeInTheDocument());

    const rejectButton = screen.getByRole("button", { name: "Reject" });
    expect(rejectButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Rejection reason"), "needs more detail");
    expect(rejectButton).toBeEnabled();

    await userEvent.click(rejectButton);
    await waitFor(() => expect(reject).toHaveBeenCalledWith("i1", "needs more detail"));
  });

  it("only shows lifecycle actions for the relevant status (U15)", async () => {
    // in_review -> no lifecycle card at all
    get.mockResolvedValue(itemBody);
    renderDetail();
    await waitFor(() => expect(screen.getByText("Needs review")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Deprecate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("shows Deprecate and Archive for a published item (U15)", async () => {
    get.mockResolvedValue({ ...itemBody, status: "published" });
    renderDetail();
    await waitFor(() => expect(screen.getByText("Needs review")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Deprecate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("shows only Archive for a deprecated item (U15)", async () => {
    get.mockResolvedValue({ ...itemBody, status: "deprecated" });
    renderDetail();
    await waitFor(() => expect(screen.getByText("Needs review")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Deprecate" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });
});
