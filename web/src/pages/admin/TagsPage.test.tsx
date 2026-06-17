import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const list = vi.fn();
const create = vi.fn();
const remove = vi.fn();

vi.mock("../../api/resources.ts", () => ({
  tagsApi: {
    list: () => list(),
    create: (label: string) => create(label),
    remove: (id: string) => remove(id),
  },
}));

const { TagsPage } = await import("./TagsPage.tsx");

afterEach(() => {
  vi.clearAllMocks();
});

describe("TagsPage", () => {
  it("lists tags and shows a muted marker for system tags instead of a remove control", async () => {
    list.mockResolvedValue({
      tags: [
        { id: "t1", slug: "ops", label: "Ops", scope: "tenant" },
        { id: "t2", slug: "core", label: "Core", scope: "system" },
      ],
    });

    render(<TagsPage />);

    expect(screen.getByRole("heading", { name: "Tenant tags" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Ops")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Remove/i })).toBeInTheDocument();
    expect(screen.getByText("system", { selector: "span" })).toBeInTheDocument();
  });

  it("shows an empty state when there are no tags", async () => {
    list.mockResolvedValue({ tags: [] });

    render(<TagsPage />);

    await waitFor(() => expect(screen.getByText("No tags yet.")).toBeInTheDocument());
  });

  it("removes a tenant tag after confirming in the dialog", async () => {
    list.mockResolvedValue({
      tags: [{ id: "t1", slug: "ops", label: "Ops", scope: "tenant" }],
    });
    remove.mockResolvedValue(undefined);

    render(<TagsPage />);
    await waitFor(() => expect(screen.getByText("Ops")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /Remove/i }));
    expect(screen.getByText("Remove this tag?")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith("t1"));
  });
});
