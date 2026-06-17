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
  it("renders the label and the body textarea in edit mode by default", () => {
    render(<Harness />);
    expect(screen.getByText("Body (markdown)")).toBeInTheDocument();
    const textarea = document.getElementById("md-body") as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();
    expect(textarea?.value).toContain("# Heading");
    expect(screen.queryByTestId("md-preview")).toBeNull();
  });

  it("renders the markdown in a preview div when toggled, then returns to the textarea", async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Preview" }));

    const preview = screen.getByTestId("md-preview");
    expect(preview).toHaveClass("markdown");
    expect(preview.querySelector("h1")?.textContent).toBe("Heading");
    expect(preview.querySelector("strong")?.textContent).toBe("bold");
    expect(document.getElementById("md-body")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(document.getElementById("md-body")).not.toBeNull();
    expect(screen.queryByTestId("md-preview")).toBeNull();
  });
});
