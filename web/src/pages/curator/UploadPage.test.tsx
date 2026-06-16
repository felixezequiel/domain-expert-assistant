import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadPage } from "./UploadPage.tsx";
import { mockFetchSequence, installFetch } from "../../test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("UploadPage", () => {
  it("uploads a file and polls the job until completion", async () => {
    installFetch(
      mockFetchSequence([
        { status: 200, body: { collections: [{ id: "c1", name: "Docs", description: null, createdBy: "u" }] } },
        { status: 202, body: { jobId: "job-1", status: "pending" } }, // upload accepted
        {
          status: 200,
          body: { id: "job-1", filename: "doc.md", mimeType: "text/markdown", status: "completed", createdItemId: "i9", failureReason: null },
        },
      ]),
    );

    render(<UploadPage />);

    await waitFor(() => expect(screen.getByText("Docs")).toBeInTheDocument());

    const file = new File(["# hello"], "doc.md", { type: "text/markdown" });
    await userEvent.upload(screen.getByLabelText("File"), file);
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));

    await waitFor(() => expect(screen.getByTestId("job-status")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("completed")).toBeInTheDocument());
    expect(screen.getByText("i9")).toBeInTheDocument();
  });
});
