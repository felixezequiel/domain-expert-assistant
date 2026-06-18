import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "./PageHeader.tsx";

describe("PageHeader", () => {
  it("renders the title as a heading", () => {
    render(<PageHeader title="Items" />);
    expect(screen.getByRole("heading", { name: "Items" })).toBeInTheDocument();
  });

  it("renders the description and actions when provided", () => {
    render(<PageHeader title="Items" description="Manage knowledge" actions={<button>New</button>} />);
    expect(screen.getByText("Manage knowledge")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });
});
