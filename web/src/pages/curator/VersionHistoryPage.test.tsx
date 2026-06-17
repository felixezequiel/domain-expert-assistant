import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { VersionHistoryPage } from "./VersionHistoryPage.tsx";
import { mockFetchSequence, installFetch } from "../../test/index.ts";

// VersionDiff lazy-loads Monaco, which can't run in jsdom — stub it to a plain element that
// surfaces the two compared bodies, so the page wiring (which versions are diffed) is testable.
vi.mock("../../components/VersionDiff.tsx", () => ({
  VersionDiff: ({
    oldText,
    newText,
    oldLabel,
    newLabel,
  }: {
    oldText: string;
    newText: string;
    oldLabel: string;
    newLabel: string;
  }) => (
    <div data-testid="version-diff" data-old={oldText} data-new={newText}>
      {oldLabel} {newLabel}
    </div>
  ),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

function version(versionNumber: number, body: string) {
  return {
    itemId: "i1",
    versionNumber,
    title: `v${versionNumber}`,
    body,
    tagIds: [],
    sensitivity: "internal",
    createdBy: "u1",
    createdByName: "Ada Lovelace",
    createdAt: "2026-01-01T10:00:00.000Z",
  };
}

describe("VersionHistoryPage", () => {
  it("diffs the two latest versions and rolls back behind a confirmation dialog", async () => {
    const fetchFn = mockFetchSequence([
      { status: 200, body: { versions: [version(1, "first line"), version(2, "second line")] } },
      { status: 200, body: { id: "i1", status: "draft" } }, // rollback
      {
        status: 200,
        body: { versions: [version(1, "first line"), version(2, "second line"), version(3, "first line")] },
      },
    ]);
    installFetch(fetchFn);

    render(
      <MemoryRouter initialEntries={["/items/i1/versions"]}>
        <Routes>
          <Route path="/items/:itemId/versions" element={<VersionHistoryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Version history" })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByTestId("version-diff")).toBeInTheDocument());
    // Author shown as a resolved display name, not the raw UUID (U2).
    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0);
    expect(screen.queryByText("u1")).not.toBeInTheDocument();
    // The two latest versions are compared (v1 body as original, v2 body as modified).
    const diff = screen.getByTestId("version-diff");
    expect(diff).toHaveAttribute("data-old", "first line");
    expect(diff).toHaveAttribute("data-new", "second line");

    // (B4) rollback opens a confirmation dialog before calling the API.
    await userEvent.click(screen.getAllByRole("button", { name: /Roll back to this/ })[0]!);
    await waitFor(() => expect(screen.getByText(/returns the item to draft/i)).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      const rollbackCall = fetchFn.mock.calls.find(([url]) => url === "/items/i1/rollback");
      expect(rollbackCall).toBeDefined();
    });
  });
});
