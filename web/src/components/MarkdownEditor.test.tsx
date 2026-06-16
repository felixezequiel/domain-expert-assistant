import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarkdownEditor } from "./MarkdownEditor.tsx";

function Harness(): JSX.Element {
  const [value, setValue] = useState("# Heading\n\nsome **bold** text");
  return <MarkdownEditor value={value} onChange={setValue} />;
}

describe("MarkdownEditor", () => {
  it("edits in a textarea by default", async () => {
    render(<Harness />);
    const textarea = screen.getByLabelText("Body (markdown)") as HTMLTextAreaElement;
    expect(textarea.value).toContain("# Heading");
  });

  it("renders the markdown as HTML in preview mode", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Preview" }));
    const preview = screen.getByTestId("md-preview");
    expect(preview.querySelector("h1")?.textContent).toBe("Heading");
    expect(preview.querySelector("strong")?.textContent).toBe("bold");
  });

  it("toggles back to edit mode", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Preview" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Body (markdown)")).toBeInTheDocument();
  });
});
