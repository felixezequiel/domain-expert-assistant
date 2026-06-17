import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Monaco can't render in jsdom, so stub the React wrapper (loader + DiffEditor) and record the
// props it receives. `monaco-editor` and its ?worker are aliased to stubs in vite.config.
const diffEditorProps = vi.fn();
vi.mock("@monaco-editor/react", () => ({
  loader: { config: vi.fn() },
  DiffEditor: (props: Record<string, unknown>) => {
    diffEditorProps(props);
    return <div data-testid="monaco-diff" />;
  },
}));

import MonacoVersionDiff from "./MonacoVersionDiff.tsx";

describe("MonacoVersionDiff", () => {
  it("feeds both versions to a read-only side-by-side Monokai markdown diff", () => {
    render(<MonacoVersionDiff oldText={"a\nb"} newText={"a\nc"} />);

    expect(screen.getByTestId("monaco-diff")).toBeInTheDocument();
    const props = diffEditorProps.mock.calls[0]![0] as Record<string, unknown>;
    expect(props.original).toBe("a\nb");
    expect(props.modified).toBe("a\nc");
    expect(props.theme).toBe("monokai");
    expect(props.language).toBe("markdown");
    expect((props.options as { readOnly?: boolean }).readOnly).toBe(true);
    expect((props.options as { renderSideBySide?: boolean }).renderSideBySide).toBe(true);
    // Models are kept (not disposed by the wrapper) to avoid Monaco's unmount dispose race.
    expect(props.keepCurrentOriginalModel).toBe(true);
    expect(props.keepCurrentModifiedModel).toBe(true);
  });
});
