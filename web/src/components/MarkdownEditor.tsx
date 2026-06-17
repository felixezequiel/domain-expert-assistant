import { useState } from "react";
import Markdown from "react-markdown";
import { Eye, Pencil } from "lucide-react";
import { Button } from "./ui/button.tsx";
import { Label } from "./ui/label.tsx";
import { Textarea } from "./ui/textarea.tsx";

// Markdown body editor with a live preview toggle (ADR-023: the knowledge body is markdown).
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="md-body">{label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowPreview((previous) => !previous)}
          aria-pressed={showPreview}
        >
          {showPreview ? <Pencil className="mr-1.5 h-3.5 w-3.5" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
          {showPreview ? "Edit" : "Preview"}
        </Button>
      </div>
      {showPreview ? (
        <div
          className="markdown min-h-[16rem] rounded-md border border-input bg-card px-4 py-3"
          data-testid="md-preview"
        >
          <Markdown>{value}</Markdown>
        </div>
      ) : (
        <Textarea
          id="md-body"
          value={value}
          rows={16}
          className="font-mono text-sm"
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}
