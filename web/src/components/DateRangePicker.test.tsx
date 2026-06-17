import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DateRangePicker } from "./DateRangePicker.tsx";

describe("DateRangePicker", () => {
  it("shows the placeholder when no range is selected", () => {
    render(<DateRangePicker value={undefined} onChange={vi.fn()} placeholder="Any date" ariaLabel="Date range" />);
    expect(screen.getByRole("button", { name: "Date range" })).toHaveTextContent("Any date");
  });

  it("shows a from–to label when a full range is selected", () => {
    render(
      <DateRangePicker
        value={{ from: new Date("2026-06-01T12:00:00.000Z"), to: new Date("2026-06-17T12:00:00.000Z") }}
        onChange={vi.fn()}
        ariaLabel="Date range"
      />,
    );
    const text = screen.getByRole("button", { name: "Date range" }).textContent ?? "";
    expect(text).toContain("–");
    expect(text).toMatch(/2026/);
  });
});
