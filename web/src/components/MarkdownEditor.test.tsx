import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarkdownEditor } from "./MarkdownEditor.tsx";

// The write surface lazy-loads Monaco, which can't run in jsdom — stub it with a controlled
// textarea so the value/onChange wiring and the preview toggle stay testable.
vi.mock("./MonacoMarkdownEditor.tsx", () => ({
  default: ({ value, onChange }: { value: string; onChange(next: string): void }) => (
    <textarea data-testid="md-editor-input" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

function Harness(): JSX.Element {
  const [value, setValue] = useState("# Heading\n\nsome **bold** text");
  return <MarkdownEditor value={value} onChange={setValue} />;
}

describe("MarkdownEditor", () => {
  it("shows the label and the Monaco write surface in edit mode by default", async () => {
    render(<Harness />);
    expect(screen.getByText("Body (markdown)")).toBeInTheDocument();
    expect(await screen.findByTestId("md-editor-input")).toHaveValue("# Heading\n\nsome **bold** text");
    expect(screen.queryByTestId("md-preview")).toBeNull();
  });

  it("renders a markdown preview when toggled, then returns to the editor", async () => {
    render(<Harness />);
    await screen.findByTestId("md-editor-input");

    await userEvent.click(screen.getByRole("button", { name: "Preview" }));

    const preview = screen.getByTestId("md-preview");
    expect(preview).toHaveClass("markdown");
    expect(preview.querySelector("h1")?.textContent).toBe("Heading");
    expect(preview.querySelector("strong")?.textContent).toBe("bold");
    expect(screen.queryByTestId("md-editor-input")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(await screen.findByTestId("md-editor-input")).toBeInTheDocument();
    expect(screen.queryByTestId("md-preview")).toBeNull();
  });
});
