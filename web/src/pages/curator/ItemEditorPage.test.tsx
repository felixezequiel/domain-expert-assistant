import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ItemEditorPage } from "./ItemEditorPage.tsx";
import { mockFetchSequence, installFetch } from "../../test/index.ts";
import { AuthContext, type Session } from "../../auth/AuthContext.tsx";
import { capabilitiesForRoles } from "../../auth/capabilities.ts";

const curatorSession: Session = {
  user: { userId: "u1", companyId: "c1", email: "carl@e2e.test", displayName: "Carl", roles: ["curator"], status: "active" },
  capabilities: capabilitiesForRoles(["curator"]),
};

// The body editor lazy-loads Monaco (can't run in jsdom); this page test exercises the
// page's save/submit wiring, not the editor, so stub it with a plain textarea.
vi.mock("../../components/MarkdownEditor.tsx", () => ({
  MarkdownEditor: ({ value, onChange }: { value: string; onChange(next: string): void }) => (
    <textarea data-testid="md-body" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

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
          lastRejectionReason: null,
        },
      },
      { status: 200, body: { id: "i1", status: "in_review" } }, // submit
    ]);
    installFetch(fetchFn);

    render(
      <AuthContext.Provider
        value={{ session: curatorSession, isAuthenticated: true, loading: false, login: async () => undefined, logout: async () => undefined }}
      >
        <MemoryRouter initialEntries={["/items/i1"]}>
          <Routes>
            <Route path="/items/:itemId" element={<ItemEditorPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    await waitFor(() => expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Existing"));

    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    // Feedback is a toast now; assert the lifecycle status badge flips to "In review" instead.
    await waitFor(() => expect(screen.getByText("In review")).toBeInTheDocument());
    const submitCall = fetchFn.mock.calls.find(([url]) => url === "/items/i1/submit");
    expect(submitCall).toBeDefined();
  });

  it("saves content + tags in a single edit, with no separate retag call (B1)", async () => {
    const item = {
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
      lastRejectionReason: null,
    };
    const fetchFn = mockFetchSequence([
      { status: 200, body: { collections: [{ id: "c1", name: "Coll", description: null, createdBy: "u" }] } },
      { status: 200, body: { tags: [] } },
      { status: 200, body: item },
      { status: 200, body: { id: "i1", status: "draft" } }, // edit (PUT)
    ]);
    installFetch(fetchFn);

    render(
      <AuthContext.Provider
        value={{ session: curatorSession, isAuthenticated: true, loading: false, login: async () => undefined, logout: async () => undefined }}
      >
        <MemoryRouter initialEntries={["/items/i1"]}>
          <Routes>
            <Route path="/items/:itemId" element={<ItemEditorPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    await waitFor(() => expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Existing"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const editCall = fetchFn.mock.calls.find(
        ([url, options]) => url === "/items/i1" && (options as RequestInit | undefined)?.method === "PUT",
      );
      expect(editCall).toBeDefined();
    });
    const editCall = fetchFn.mock.calls.find(
      ([url, options]) => url === "/items/i1" && (options as RequestInit | undefined)?.method === "PUT",
    );
    expect(JSON.parse((editCall![1] as RequestInit).body as string)).toHaveProperty("tagIds");
    // The dedicated retag endpoint is no longer hit on Save.
    expect(fetchFn.mock.calls.some(([url]) => url === "/items/i1/retag")).toBe(false);
  });
});
