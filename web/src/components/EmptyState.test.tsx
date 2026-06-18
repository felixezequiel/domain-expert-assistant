import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { EmptyState } from "./EmptyState.tsx";

describe("EmptyState", () => {
  it("renders the title, description and action", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No items yet"
        description="Create your first item to get started."
        action={<button>New item</button>}
      />,
    );
    expect(screen.getByText("No items yet")).toBeInTheDocument();
    expect(screen.getByText("Create your first item to get started.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New item" })).toBeInTheDocument();
  });
});
