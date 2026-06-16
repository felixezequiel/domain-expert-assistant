import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ItemEditorPage } from "./ItemEditorPage.tsx";
import { mockFetchSequence, installFetch } from "../../test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ItemEditorPage", () => {
  it("loads an existing item and can submit it for review", async () => {
    const fetchFn = mockFetchSequence([
      { status: 200, body: { collections: [{ id: "c1", name: "Coll", description: null, createdBy: "u" }] } },
      { status: 200, body: { tags: [] } },
      {
        status: 200,
        body: {
          id: "i1",
          collectionId: "c1",
          title: "Existing",
          body: "# Body",
          tagIds: [],
          sensitivity: "internal",
          status: "draft",
          currentVersionNumber: 1,
          publishedVersionNumber: null,
          isServed: false,
          isStale: false,
        },
      },
      { status: 200, body: { id: "i1", status: "in_review" } }, // submit
    ]);
    installFetch(fetchFn);

    render(
      <MemoryRouter initialEntries={["/items/i1"]}>
        <Routes>
          <Route path="/items/:itemId" element={<ItemEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Existing"));

    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    await waitFor(() => expect(screen.getByText(/Submitted for review/i)).toBeInTheDocument());
    const submitCall = fetchFn.mock.calls.find(([url]) => url === "/items/i1/submit");
    expect(submitCall).toBeDefined();
  });
});
