import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Monaco can't render in jsdom — stub the React wrapper's default Editor and record its props.
// `monaco-editor` + its ?worker are aliased to stubs in vite.config.
const editorProps = vi.fn();
vi.mock("@monaco-editor/react", () => ({
  loader: { config: vi.fn() },
  default: (props: Record<string, unknown>) => {
    editorProps(props);
    return <div data-testid="monaco-editor" />;
  },
}));

import MonacoMarkdownEditor from "./MonacoMarkdownEditor.tsx";

describe("MonacoMarkdownEditor", () => {
  it("renders a markdown Monaco editor wired to value/onChange with the Monokai theme", () => {
    const onChange = vi.fn();
    render(<MonacoMarkdownEditor value="# hi" onChange={onChange} />);

    expect(screen.getByTestId("monaco-editor")).toBeInTheDocument();
    const props = editorProps.mock.calls[0]![0] as { value: string; language: string; theme: string; onChange(next: string | undefined): void };
    expect(props.value).toBe("# hi");
    expect(props.language).toBe("markdown");
    expect(props.theme).toBe("monokai");

    // Monaco hands back string | undefined; the wrapper normalises undefined to "".
    props.onChange(undefined);
    expect(onChange).toHaveBeenCalledWith("");
    props.onChange("# changed");
    expect(onChange).toHaveBeenCalledWith("# changed");
  });
});
