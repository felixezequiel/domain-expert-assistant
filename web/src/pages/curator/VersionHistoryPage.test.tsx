import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { VersionHistoryPage } from "./VersionHistoryPage.tsx";
import { mockFetchSequence, installFetch } from "../../test/index.ts";

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
    createdAt: "2026-01-01",
  };
}

describe("VersionHistoryPage", () => {
  it("renders the diff between the two latest versions and can roll back", async () => {
    const fetchFn = mockFetchSequence([
      { status: 200, body: { versions: [version(1, "first line"), version(2, "second line")] } },
      { status: 200, body: { id: "i1", status: "draft" } }, // rollback
      { status: 200, body: { versions: [version(1, "first line"), version(2, "second line"), version(3, "first line")] } },
    ]);
    installFetch(fetchFn);

    render(
      <MemoryRouter initialEntries={["/items/i1/versions"]}>
        <Routes>
          <Route path="/items/:itemId/versions" element={<VersionHistoryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId("version-diff")).toBeInTheDocument());
    const diff = screen.getByTestId("version-diff");
    expect(diff.querySelector('[data-change="-"]')?.textContent).toContain("first line");
    expect(diff.querySelector('[data-change="+"]')?.textContent).toContain("second line");

    await userEvent.click(screen.getAllByRole("button", { name: "Roll back to this" })[0]!);
    await waitFor(() => expect(screen.getByText(/Rolled back to version 1/i)).toBeInTheDocument());
    const rollbackCall = fetchFn.mock.calls.find(([url]) => url === "/items/i1/rollback");
    expect(rollbackCall).toBeDefined();
  });
});
