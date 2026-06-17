import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Breadcrumbs } from "./Breadcrumbs.tsx";

describe("Breadcrumbs", () => {
  it("links every crumb except the current, which renders as plain text", () => {
    render(
      <MemoryRouter>
        <Breadcrumbs items={[{ label: "Items", to: "/items" }, { label: "Edit item" }]} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Items" })).toHaveAttribute("href", "/items");
    expect(screen.queryByRole("link", { name: "Edit item" })).toBeNull();
    expect(screen.getByText("Edit item")).toBeInTheDocument();
  });
});
