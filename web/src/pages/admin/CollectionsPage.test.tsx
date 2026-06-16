import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollectionsPage } from "./CollectionsPage.tsx";
import { mockFetchSequence, installFetch } from "../../test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CollectionsPage", () => {
  it("lists collections", async () => {
    installFetch(
      mockFetchSequence([
        { status: 200, body: { collections: [{ id: "c1", name: "Runbooks", description: "ops", createdBy: "u1" }] } },
      ]),
    );
    render(<CollectionsPage />);
    await waitFor(() => expect(screen.getByText("Runbooks")).toBeInTheDocument());
    expect(screen.getByText("ops")).toBeInTheDocument();
  });

  it("creates a collection then reloads", async () => {
    const fetchFn = mockFetchSequence([
      { status: 200, body: { collections: [] } }, // initial list
      { status: 201, body: { id: "c2", name: "Policies" } }, // create
      { status: 200, body: { collections: [{ id: "c2", name: "Policies", description: null, createdBy: "u1" }] } },
    ]);
    installFetch(fetchFn);
    render(<CollectionsPage />);

    await userEvent.type(screen.getByLabelText("Name"), "Policies");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(screen.getByText("Policies")).toBeInTheDocument());
    const createCall = fetchFn.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST");
    expect(createCall?.[0]).toBe("/collections");
  });
});
