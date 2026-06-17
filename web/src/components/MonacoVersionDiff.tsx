import { DiffEditor } from "@monaco-editor/react";
import { MONOKAI_THEME } from "./monacoSetup.ts";

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
