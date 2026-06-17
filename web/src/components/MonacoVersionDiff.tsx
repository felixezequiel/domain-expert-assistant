import { DiffEditor } from "@monaco-editor/react";
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

// Bundle Monaco LOCALLY instead of @monaco-editor/react's default CDN loader, so the
// Curation & Admin SPA stays self-contained + same-origin (ADR-023) and works offline. The
// diff editor computes its diff in the base editor worker; markdown needs no language worker.
const globalWithMonaco = globalThis as typeof globalThis & {
  MonacoEnvironment?: { getWorker: () => Worker };
};
globalWithMonaco.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

const MONOKAI_THEME = "monokai";

// Monokai — the classic dark palette (bg #272822, magenta keywords, green names, cyan types,
// olive strings) plus diff insert/remove tints. This is the theme the version-compare screen
// was asked to use; defined inline so we carry no extra theme dependency.
monaco.editor.defineTheme(MONOKAI_THEME, {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "", foreground: "F8F8F2", background: "272822" },
    { token: "comment", foreground: "75715E", fontStyle: "italic" },
    { token: "string", foreground: "E6DB74" },
    { token: "number", foreground: "AE81FF" },
    { token: "keyword", foreground: "F92672" },
    { token: "type", foreground: "66D9EF", fontStyle: "italic" },
    { token: "variable", foreground: "F8F8F2" },
  ],
  colors: {
    "editor.background": "#272822",
    "editor.foreground": "#F8F8F2",
    "editorLineNumber.foreground": "#90908A",
    "editor.selectionBackground": "#49483E",
    "editor.lineHighlightBackground": "#3E3D32",
    "diffEditor.insertedTextBackground": "#A6E22E33",
    "diffEditor.removedTextBackground": "#F9267233",
    "diffEditor.insertedLineBackground": "#A6E22E1A",
    "diffEditor.removedLineBackground": "#F926721A",
  },
});

const LINE_HEIGHT_PX = 19;
const PADDING_PX = 24;
const MIN_HEIGHT_PX = 160;
const MAX_HEIGHT_PX = 640;

function diffHeight(oldText: string, newText: string): number {
  const lineCount = Math.max(oldText.split("\n").length, newText.split("\n").length);
  const fitted = lineCount * LINE_HEIGHT_PX + PADDING_PX;
  return Math.min(MAX_HEIGHT_PX, Math.max(MIN_HEIGHT_PX, fitted));
}

// The actual Monaco (VS Code) diff editor: read-only, side-by-side, Monokai. Loaded lazily by
// VersionDiff so the heavy Monaco bundle only reaches the version-history screen.
export default function MonacoVersionDiff({
  oldText,
  newText,
}: {
  readonly oldText: string;
  readonly newText: string;
}): JSX.Element {
  return (
    <DiffEditor
      original={oldText}
      modified={newText}
      language="markdown"
      theme={MONOKAI_THEME}
      height={diffHeight(oldText, newText)}
      // Don't let the wrapper dispose the text models on unmount — that disposal races the
      // diff widget's own teardown and logs "TextModel got disposed before DiffEditorWidget
      // model got reset". Prop-change updates still apply via setValue.
      keepCurrentOriginalModel
      keepCurrentModifiedModel
      options={{
        readOnly: true,
        originalEditable: false,
        renderSideBySide: true,
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderOverviewRuler: false,
        fontSize: 12,
        lineNumbersMinChars: 3,
        wordWrap: "on",
      }}
    />
  );
}
