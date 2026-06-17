import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const credentialsList = vi.fn();
const issue = vi.fn();
const rotate = vi.fn();
const revoke = vi.fn();
const collectionsList = vi.fn();

vi.mock("../../api/resources.ts", () => ({
  credentialsApi: {
    list: () => credentialsList(),
    issue: (name: string, collectionIds: ReadonlyArray<string>, ceiling: string) =>
      issue(name, collectionIds, ceiling),
    rotate: (id: string) => rotate(id),
    revoke: (id: string) => revoke(id),
  },
  collectionsApi: {
    list: () => collectionsList(),
  },
}));

const { CredentialsPage } = await import("./CredentialsPage.tsx");

beforeEach(() => {
  collectionsList.mockResolvedValue({ collections: [] });
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("CredentialsPage", () => {
  it("renders the heading and lists credentials with scope, ceiling and last-used", async () => {
    credentialsList.mockResolvedValue({
      credentials: [
        {
          id: "cr1",
          name: "bot",
          keyPrefix: "dk_abc",
          collectionIds: ["c1"],
          sensitivityCeiling: "internal",
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          lastUsedAt: null,
        },
      ],
    });

    render(<CredentialsPage />);

    expect(screen.getByRole("heading", { name: "Consumer credentials" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("bot")).toBeInTheDocument());
    expect(screen.getByText("dk_abc")).toBeInTheDocument();
    expect(screen.getByText("never")).toBeInTheDocument();
  });

  it("reveals the issued secret in a dialog after issuing", async () => {
    credentialsList.mockResolvedValue({ credentials: [] });
    issue.mockResolvedValue({ id: "cr-new", secret: "dk_ONESHOT" });

    render(<CredentialsPage />);
    await waitFor(() => expect(screen.getByText("No credentials yet.")).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText("Name"), "newbot");
    await userEvent.click(screen.getByRole("button", { name: "Issue" }));

    await waitFor(() => expect(screen.getByTestId("credential-secret")).toBeInTheDocument());
    expect(screen.getByTestId("credential-secret").textContent).toBe("dk_ONESHOT");
  });

  it("renders no rotate/revoke actions for a revoked credential", async () => {
    credentialsList.mockResolvedValue({
      credentials: [
        {
          id: "cr2",
          name: "retired",
          keyPrefix: "dk_old",
          collectionIds: [],
          sensitivityCeiling: "public",
          status: "revoked",
          createdAt: "2026-01-01T00:00:00.000Z",
          lastUsedAt: null,
        },
      ],
    });

    render(<CredentialsPage />);
    await waitFor(() => expect(screen.getByText("retired")).toBeInTheDocument());

    expect(screen.queryByRole("button", { name: /Rotate/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Revoke/i })).toBeNull();
  });
});
