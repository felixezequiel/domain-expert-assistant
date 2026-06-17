import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../api/resources.ts", () => ({
  collectionsApi: {
    list: vi.fn(async () => ({ collections: [{ id: "c1", name: "Handbook", description: null, createdBy: "u1" }] })),
  },
  searchApi: {
    search: vi.fn(async () => ({
      results: [
        {
          itemId: "i1",
          title: "Onboarding guide",
          collectionId: "c1",
          sensitivity: "internal",
          chunkIndex: 0,
          content: "# Onboarding guide\n\nHow to onboard a **new** teammate step by step.",
          score: 0.0163934426229508,
          publishedAt: "2026-01-01",
          stale: true,
        },
      ],
    })),
  },
}));

import { SearchPage } from "./SearchPage.tsx";

function renderPage(): void {
  render(
    <MemoryRouter>
      <SearchPage />
    </MemoryRouter>,
  );
}

describe("SearchPage", () => {
  it("renders the heading and search results with stripped snippet, collection name and a deprecated badge", async () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Search" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Query"), "onboard");
    await userEvent.click(screen.getByRole("button", { name: /search/i }));

    await waitFor(() => expect(screen.getByText("Onboarding guide")).toBeInTheDocument());

    const result = screen.getByTestId("search-results");
    // Snippet is markdown-stripped (no `#`/`**`) and does not repeat the title line.
    expect(result.textContent).toContain("How to onboard a new teammate");
    expect(result.textContent).not.toContain("#");
    expect(result.textContent).not.toContain("**");
    // The title heading is shown once; the snippet must NOT re-print it (P1 de-dup).
    expect(screen.getAllByText(/Onboarding guide/)).toHaveLength(1);
    // Collection NAME, not the raw UUID, and no raw score number leaks into the body.
    expect(result.textContent).toContain("Handbook");
    expect(result.textContent).not.toContain("0.0163934426229508");
    expect(screen.getByText("Deprecated")).toBeInTheDocument();
  });

  it("rounds the relevance score to two decimals in the match tooltip (P5)", async () => {
    renderPage();

    await userEvent.type(screen.getByLabelText("Query"), "onboard");
    await userEvent.click(screen.getByRole("button", { name: /search/i }));

    await waitFor(() => expect(screen.getByText("match")).toBeInTheDocument());

    expect(screen.getByText("match")).toHaveAttribute("title", "relevance score 0.02");
  });
});
