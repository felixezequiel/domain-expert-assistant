import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagPicker, type TagOption } from "./TagPicker.tsx";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

const TAGS: ReadonlyArray<TagOption> = [
  { id: "t1", label: "Glossary" },
  { id: "t2", label: "Process" },
];

describe("TagPicker", () => {
  it("renders each tag and reflects the selected ones", () => {
    render(<TagPicker options={TAGS} value={["t1"]} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Glossary" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Process" })).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles a tag on click", async () => {
    const onChange = vi.fn();
    render(<TagPicker options={TAGS} value={[]} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Process" }));
    expect(onChange).toHaveBeenCalledWith(["t2"]);
  });

  it("creates a tag inline and selects it", async () => {
    const onChange = vi.fn();
    const onCreate = vi.fn(async (label: string) => ({ id: "t3", label }));
    render(<TagPicker options={TAGS} value={[]} onChange={onChange} onCreate={onCreate} />);

    await userEvent.click(screen.getByRole("button", { name: "Add tag" }));
    await userEvent.type(screen.getByPlaceholderText(/Search or create/), "Runbook");
    await userEvent.click(screen.getByRole("button", { name: /Create tag/ }));

    expect(onCreate).toHaveBeenCalledWith("Runbook");
    expect(onChange).toHaveBeenCalledWith(["t3"]);
  });
});
