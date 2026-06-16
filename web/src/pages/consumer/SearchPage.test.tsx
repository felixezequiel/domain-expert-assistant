import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SearchPage } from "./SearchPage.tsx";
import { mockFetchSequence, installFetch } from "../../test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SearchPage", () => {
  it("renders search results with attribution and a stale flag", async () => {
    installFetch(
      mockFetchSequence([
        { status: 200, body: { collections: [] } },
        {
          status: 200,
          body: {
            results: [
              {
                itemId: "i1",
                title: "Onboarding guide",
                collectionId: "c1",
                sensitivity: "internal",
                chunkIndex: 0,
                content: "how to onboard",
                score: 0.912,
                publishedAt: "2026-01-01",
                stale: true,
              },
            ],
          },
        },
      ]),
    );

    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText("Query"), "onboard");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByTestId("search-results")).toBeInTheDocument());
    expect(screen.getByText("Onboarding guide")).toBeInTheDocument();
    expect(screen.getByText("how to onboard")).toBeInTheDocument();
    expect(screen.getByText(/score 0.912/)).toBeInTheDocument();
    expect(screen.getByText("stale")).toBeInTheDocument();
  });

  it("shows a 'not permitted' notice when search 403s", async () => {
    installFetch(
      mockFetchSequence([
        { status: 200, body: { collections: [] } },
        { status: 403, body: { error: "Forbidden" } },
      ]),
    );

    render(
      <MemoryRouter>
        <SearchPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText("Query"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText(/not permitted/i)).toBeInTheDocument());
  });
});
