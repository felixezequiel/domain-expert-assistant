import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// The Monaco-powered diff lives in its own chunk; lazy-load it so the multi-MB Monaco bundle
// only reaches the version-history screen, not every page.
const MonacoVersionDiff = lazy(() => import("./MonacoVersionDiff.tsx"));

// Side-by-side version comparison (PRD-6: "UI mostra o diff entre versões") powered by
// Monaco's diff editor — the VS Code experience — themed Monokai. The header keeps the
// −old / +new labels above the editor.
export function VersionDiff({
  oldText,
  newText,
  oldLabel,
  newLabel,
}: {
  readonly oldText: string;
  readonly newText: string;
  readonly oldLabel: string;
  readonly newLabel: string;
}): JSX.Element {
  return (
    <div className="overflow-hidden rounded-lg border border-border" data-testid="version-diff">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
        <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-destructive">− {oldLabel}</span>
        <span className="rounded bg-success/15 px-1.5 py-0.5 text-success">+ {newLabel}</span>
      </div>
      <Suspense
        fallback={
          <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading diff…
          </div>
        }
      >
        <MonacoVersionDiff oldText={oldText} newText={newText} />
      </Suspense>
    </div>
  );
}
