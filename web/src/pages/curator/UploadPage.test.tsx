import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { UploadPage } from "./UploadPage.tsx";
import { mockFetchSequence, installFetch } from "../../test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("UploadPage", () => {
  it("shows the selected file, uploads it, and surfaces the created item on completion", async () => {
    installFetch(
      mockFetchSequence([
        { status: 200, body: { collections: [{ id: "c1", name: "Docs", description: null, createdBy: "u" }] } },
        { status: 202, body: { jobId: "job-1", status: "pending" } }, // upload accepted
        {
          status: 200,
          body: {
            id: "job-1",
            filename: "doc.md",
            mimeType: "text/markdown",
            status: "done",
            createdItemId: "i9",
            failureReason: null,
          },
        },
      ]),
    );

    render(
      <MemoryRouter>
        <UploadPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Upload document" })).toBeInTheDocument();

    const file = new File(["# hello"], "doc.md", { type: "text/markdown" });
    await userEvent.upload(screen.getByLabelText("File"), file);

    // (U8) the chosen filename + size are shown before uploading.
    expect(screen.getByText("doc.md")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Upload" }));

    await waitFor(() => expect(screen.getByText("Ingestion complete")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Open created item/ })).toHaveAttribute(
      "href",
      "/items/i9",
    );
  });
});
