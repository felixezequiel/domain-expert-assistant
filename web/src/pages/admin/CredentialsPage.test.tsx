import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CredentialsPage } from "./CredentialsPage.tsx";
import { mockFetchSequence, installFetch } from "../../test/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } });
});

describe("CredentialsPage", () => {
  it("lists existing credentials with their scope and ceiling", async () => {
    installFetch(
      mockFetchSequence([
        {
          status: 200,
          body: {
            credentials: [
              {
                id: "cr1",
                name: "bot",
                keyPrefix: "dk_abc",
                collectionIds: ["c1"],
                sensitivityCeiling: "internal",
                status: "active",
                createdAt: "2026-01-01",
                lastUsedAt: null,
              },
            ],
          },
        },
        { status: 200, body: { collections: [] } },
      ]),
    );

    render(<CredentialsPage />);

    await waitFor(() => expect(screen.getByText("bot")).toBeInTheDocument());
    expect(screen.getByText("dk_abc")).toBeInTheDocument();
    expect(screen.getByText("never")).toBeInTheDocument();
  });

  it("shows the issued secret once in a dialog and never after closing", async () => {
    installFetch(
      mockFetchSequence([
        { status: 200, body: { credentials: [] } }, // initial list
        { status: 200, body: { collections: [] } }, // collections
        { status: 201, body: { id: "cr-new", secret: "dk_ONESHOT" } }, // issue
        { status: 200, body: { credentials: [] } }, // reload after issue
      ]),
    );

    render(<CredentialsPage />);

    await userEvent.type(screen.getByLabelText("Name"), "newbot");
    await userEvent.click(screen.getByRole("button", { name: "Issue" }));

    await waitFor(() => expect(screen.getByTestId("credential-secret")).toBeInTheDocument());
    expect(screen.getByTestId("credential-secret").textContent).toBe("dk_ONESHOT");

    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByTestId("credential-secret")).toBeNull();
  });
});
