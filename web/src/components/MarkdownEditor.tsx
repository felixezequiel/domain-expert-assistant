import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import { Eye, Loader2, Pencil } from "lucide-react";
import { Button } from "./ui/button.tsx";
import { Label } from "./ui/label.tsx";

// The write surface is Monaco (VS Code) so authors get familiar shortcuts; lazy-loaded so the
// heavy Monaco bundle only reaches the item editor. The import/upload path is separate.
const MonacoMarkdownEditor = lazy(() => import("./MonacoMarkdownEditor.tsx"));

// Markdown body editor with a live preview toggle (ADR-023: the knowledge body is markdown).
export function MarkdownEditor({
  value,
  onChange,
  label,
}: {
  readonly value: string;
  onChange(next: string): void;
  readonly label?: string;
}): JSX.Element {
  const { t } = useTranslation();
  const [showPreview, setShowPreview] = useState(false);
  const resolvedLabel = label ?? t("knowledge.markdownEditor.label");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{resolvedLabel}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowPreview((previous) => !previous)}
          aria-pressed={showPreview}
        >
          {showPreview ? <Pencil className="mr-1.5 h-3.5 w-3.5" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
          {showPreview ? t("knowledge.markdownEditor.edit") : t("knowledge.markdownEditor.preview")}
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
        <div className="overflow-hidden rounded-md border border-input" data-testid="md-editor">
          <Suspense
            fallback={
              <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {t("knowledge.markdownEditor.loading")}
              </div>
            }
          >
            <MonacoMarkdownEditor value={value} onChange={onChange} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
