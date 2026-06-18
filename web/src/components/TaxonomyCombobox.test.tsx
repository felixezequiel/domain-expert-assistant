import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaxonomyCombobox, type TaxonomyOption } from "./TaxonomyCombobox.tsx";

beforeAll(() => {
  // cmdk scrolls the active item into view; Radix Popover reads pointer-capture APIs. jsdom
  // implements none of these, so stub them so the popover can open in tests.
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

const OPTIONS: ReadonlyArray<TaxonomyOption> = [
  { value: "c1", label: "Runbooks" },
  { value: "c2", label: "Policies" },
];

describe("TaxonomyCombobox", () => {
  it("shows the selected option's label on the trigger", () => {
    render(
      <TaxonomyCombobox options={OPTIONS} value="c2" onChange={() => {}} ariaLabel="Collection" placeholder="Select…" />,
    );
    expect(screen.getByRole("combobox", { name: "Collection" })).toHaveTextContent("Policies");
  });

  it("picks an existing option", async () => {
    const onChange = vi.fn();
    render(
      <TaxonomyCombobox options={OPTIONS} value="" onChange={onChange} ariaLabel="Collection" placeholder="Select…" />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Collection" }));
    await userEvent.click(await screen.findByText("Runbooks"));
    expect(onChange).toHaveBeenCalledWith("c1");
  });

  it("creates a new option inline and selects it", async () => {
    const onChange = vi.fn();
    const onCreate = vi.fn(async (label: string) => ({ value: "c3", label }));
    render(
      <TaxonomyCombobox
        options={OPTIONS}
        value=""
        onChange={onChange}
        onCreate={onCreate}
        ariaLabel="Collection"
        placeholder="Select…"
      />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Collection" }));
    await userEvent.type(screen.getByPlaceholderText("Select…"), "Incidents");
    await userEvent.click(await screen.findByText(/Create/));
    expect(onCreate).toHaveBeenCalledWith("Incidents");
    expect(onChange).toHaveBeenCalledWith("c3");
  });

  it("does not offer to create when the typed name already exists", async () => {
    const onCreate = vi.fn(async (label: string) => ({ value: "c9", label }));
    render(
      <TaxonomyCombobox
        options={OPTIONS}
        value=""
        onChange={() => {}}
        onCreate={onCreate}
        ariaLabel="Collection"
        placeholder="Select…"
      />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Collection" }));
    await userEvent.type(screen.getByPlaceholderText("Select…"), "Runbooks");
    expect(screen.queryByText(/Create/)).toBeNull();
  });
});
