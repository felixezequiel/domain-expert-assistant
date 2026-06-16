import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TagsPage } from "./TagsPage.tsx";
import { mockFetchSequence, installFetch } from "../../test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TagsPage", () => {
  it("lists tags and disables removing system tags", async () => {
    installFetch(
      mockFetchSequence([
        {
          status: 200,
          body: {
            tags: [
              { id: "t1", slug: "ops", label: "Ops", scope: "tenant" },
              { id: "t2", slug: "core", label: "Core", scope: "system" },
            ],
          },
        },
      ]),
    );
    render(<TagsPage />);

    await waitFor(() => expect(screen.getByText("Ops")).toBeInTheDocument());
    // The tenant tag is removable; the system tag is not (shows a "system" marker instead).
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
    expect(screen.getByText("system", { selector: "span" })).toBeInTheDocument();
  });
});
