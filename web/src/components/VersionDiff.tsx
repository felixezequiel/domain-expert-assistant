import { diffLines, type Change } from "diff";
import { cn } from "../lib/utils.ts";

// Line-level diff between two version bodies (PRD-6: "UI mostra o diff entre versões").
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
  const changes: Change[] = diffLines(oldText, newText);

  return (
    <div className="overflow-hidden rounded-lg border border-border" data-testid="version-diff">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
        <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-destructive">− {oldLabel}</span>
        <span className="rounded bg-success/15 px-1.5 py-0.5 text-success">+ {newLabel}</span>
      </div>
      <pre className="overflow-x-auto bg-card p-0 font-mono text-xs leading-relaxed">
        {changes.map((change, index) => (
          <DiffChange key={index} change={change} />
        ))}
      </pre>
    </div>
  );
}

function DiffChange({ change }: { readonly change: Change }): JSX.Element {
  const lines = change.value.replace(/\n$/, "").split("\n");
  let lineClass = "text-foreground/80";
  let prefix = "  ";
  let kind = "context";
  if (change.added === true) {
    lineClass = "bg-success/10 text-success";
    prefix = "+ ";
    kind = "+";
  } else if (change.removed === true) {
    lineClass = "bg-destructive/10 text-destructive";
    prefix = "- ";
    kind = "-";
  }
  return (
    <>
      {lines.map((line, index) => (
        <span key={index} className={cn("block px-3", lineClass)} data-change={kind}>
          {prefix}
          {line}
        </span>
      ))}
    </>
  );
}
