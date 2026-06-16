import { useState } from "react";
import Markdown from "react-markdown";

// Markdown body editor with a live preview toggle (ADR-023: the knowledge body is
// markdown). The input is a plain textarea; preview renders via react-markdown.
export function MarkdownEditor({
  value,
  onChange,
  label = "Body (markdown)",
}: {
  readonly value: string;
  onChange(next: string): void;
  readonly label?: string;
}): JSX.Element {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="md-editor">
      <div className="md-editor__toolbar">
        <label htmlFor="md-body">{label}</label>
        <button
          type="button"
          onClick={() => setShowPreview((previous) => !previous)}
          aria-pressed={showPreview}
        >
          {showPreview ? "Edit" : "Preview"}
        </button>
      </div>
      {showPreview ? (
        <div className="md-editor__preview" data-testid="md-preview">
          <Markdown>{value}</Markdown>
        </div>
      ) : (
        <textarea
          id="md-body"
          className="md-editor__textarea"
          value={value}
          rows={16}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}
