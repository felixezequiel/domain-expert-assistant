import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { MetricCard } from "./MetricCard.tsx";

describe("MetricCard", () => {
  it("renders the label, value and hint", () => {
    render(<MetricCard label="Published" value={7} icon={BookOpen} hint="2 stale" />);
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("2 stale")).toBeInTheDocument();
  });

  it("becomes a link to its detail route when `to` is set", () => {
    render(
      <MemoryRouter>
        <MetricCard label="Published" value={7} icon={BookOpen} to="/catalog" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "/catalog");
  });
});
