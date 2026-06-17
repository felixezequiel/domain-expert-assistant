import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VersionDiff } from "./VersionDiff.tsx";

// VersionDiff lazy-loads the Monaco editor, which can't run in jsdom — stub the lazy child
// and assert VersionDiff renders the labels and hands both versions to it.
vi.mock("./MonacoVersionDiff.tsx", () => ({
  default: ({ oldText, newText }: { oldText: string; newText: string }) => (
    <div data-testid="monaco-diff" data-old={oldText} data-new={newText} />
  ),
}));

describe("VersionDiff", () => {
  it("shows both version labels and delegates both texts to the Monaco diff", async () => {
    render(
      <VersionDiff oldText="old body" newText="new body" oldLabel="v3" newLabel="v4" />,
    );

    expect(screen.getByText(/v3/)).toBeInTheDocument();
    expect(screen.getByText(/v4/)).toBeInTheDocument();

    const editor = await screen.findByTestId("monaco-diff");
    expect(editor).toHaveAttribute("data-old", "old body");
    expect(editor).toHaveAttribute("data-new", "new body");
  });
});
