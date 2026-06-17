import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

// Shared Monaco bootstrap for the version diff and the markdown editor. Bundles Monaco
// LOCALLY instead of @monaco-editor/react's default CDN loader, so the Curation & Admin SPA
// stays self-contained + same-origin (ADR-023) and works offline. Markdown needs only the
// base editor worker.
const globalWithMonaco = globalThis as typeof globalThis & {
  MonacoEnvironment?: { getWorker: () => Worker };
};
globalWithMonaco.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

export const MONOKAI_THEME = "monokai";

// Monokai — the classic dark palette (bg #272822, magenta keywords, green names, cyan types,
// olive strings) plus diff insert/remove tints. Defined inline so we carry no theme dep.
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
