import Editor from "@monaco-editor/react";
import { MONOKAI_THEME } from "./monacoSetup.ts";

const DEFAULT_HEIGHT_PX = 384;

// The Monaco (VS Code) editor for writing a knowledge item's markdown body — so authors get
// the familiar VS Code editing/shortcuts. Loaded lazily by MarkdownEditor so the heavy Monaco
// bundle only reaches the item editor, not every page.
export default function MonacoMarkdownEditor({
  value,
  onChange,
  height = DEFAULT_HEIGHT_PX,
}: {
  readonly value: string;
  onChange(next: string): void;
  readonly height?: number;
}): JSX.Element {
  return (
    <Editor
      value={value}
      onChange={(next) => onChange(next ?? "")}
      language="markdown"
      theme={MONOKAI_THEME}
      height={height}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        wordWrap: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        lineNumbers: "on",
        renderLineHighlight: "line",
        padding: { top: 8, bottom: 8 },
      }}
    />
  );
}
