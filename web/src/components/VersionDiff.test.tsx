import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VersionDiff } from "./VersionDiff.tsx";

describe("VersionDiff", () => {
  it("marks added and removed lines between two versions", () => {
    render(
      <VersionDiff
        oldText={"line one\nline two\nline three"}
        newText={"line one\nline two changed\nline three"}
        oldLabel="v1"
        newLabel="v2"
      />,
    );

    const diff = screen.getByTestId("version-diff");
    expect(diff.querySelector('[data-change="-"]')?.textContent).toContain("line two");
    expect(diff.querySelector('[data-change="+"]')?.textContent).toContain("line two changed");
  });

  it("shows both version labels", () => {
    render(<VersionDiff oldText="a" newText="b" oldLabel="v3" newLabel="v4" />);
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText("v4")).toBeInTheDocument();
  });

  it("renders only context lines when the texts are identical", () => {
    render(<VersionDiff oldText={"same\ntext"} newText={"same\ntext"} oldLabel="v1" newLabel="v1" />);
    const diff = screen.getByTestId("version-diff");
    expect(diff.querySelector('[data-change="+"]')).toBeNull();
    expect(diff.querySelector('[data-change="-"]')).toBeNull();
  });
});
