import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const list = vi.fn();
const create = vi.fn();
const rename = vi.fn();

vi.mock("../../api/resources.ts", () => ({
  collectionsApi: {
    list: () => list(),
    create: (name: string, description?: string) => create(name, description),
    rename: (id: string, name: string) => rename(id, name),
  },
}));

const { CollectionsPage } = await import("./CollectionsPage.tsx");

afterEach(() => {
  vi.clearAllMocks();
});

describe("CollectionsPage", () => {
  it("renders the heading and lists collections", async () => {
    list.mockResolvedValue({
      collections: [{ id: "c1", name: "Runbooks", description: "ops", createdBy: "u1" }],
    });

    render(<CollectionsPage />);

    expect(screen.getByRole("heading", { name: "Collections" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Runbooks")).toBeInTheDocument());
    expect(screen.getByText("ops")).toBeInTheDocument();
  });

  it("shows an empty state when there are no collections", async () => {
    list.mockResolvedValue({ collections: [] });

    render(<CollectionsPage />);

    await waitFor(() => expect(screen.getByText("No collections yet.")).toBeInTheDocument());
  });

  it("opens a rename dialog prefilled with the current name and saves", async () => {
    list.mockResolvedValue({
      collections: [{ id: "c1", name: "Runbooks", description: null, createdBy: "u1" }],
    });
    rename.mockResolvedValue({ id: "c1", name: "Playbooks" });

    render(<CollectionsPage />);
    await waitFor(() => expect(screen.getByText("Runbooks")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /Rename/i }));

    const input = screen.getByLabelText("Name", { selector: "#coll-rename" });
    expect(input).toHaveValue("Runbooks");

    await userEvent.clear(input);
    await userEvent.type(input, "Playbooks");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(rename).toHaveBeenCalledWith("c1", "Playbooks"));
  });
});
