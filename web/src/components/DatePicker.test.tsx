import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DatePicker } from "./DatePicker.tsx";

describe("DatePicker", () => {
  it("shows the placeholder when no date is selected", () => {
    render(<DatePicker value={null} onChange={vi.fn()} placeholder="From date" ariaLabel="From" />);
    expect(screen.getByRole("button", { name: "From" })).toHaveTextContent("From date");
  });

  it("shows the formatted date when a value is selected", () => {
    render(<DatePicker value={new Date("2026-06-17T12:00:00.000Z")} onChange={vi.fn()} ariaLabel="From" />);
    expect(screen.getByRole("button", { name: "From" }).textContent).toMatch(/2026/);
  });
});
