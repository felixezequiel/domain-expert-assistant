import { diffLines, type Change } from "diff";

// Line-level diff between two version bodies (PRD-6: "UI mostra o diff entre versões").
// Uses the `diff` lib's diffLines; each change is rendered as added/removed/unchanged.
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
    <div className="diff" data-testid="version-diff">
      <div className="diff__header">
        <span className="diff__label diff__label--old">{oldLabel}</span>
        <span className="diff__label diff__label--new">{newLabel}</span>
      </div>
      <pre className="diff__body">
        {changes.map((change, index) => (
          <DiffChange key={index} change={change} />
        ))}
      </pre>
    </div>
  );
}

function DiffChange({ change }: { readonly change: Change }): JSX.Element {
  const lines = change.value.replace(/\n$/, "").split("\n");
  let className = "diff__line";
  let prefix = "  ";
  if (change.added === true) {
    className = "diff__line diff__line--added";
    prefix = "+ ";
  } else if (change.removed === true) {
    className = "diff__line diff__line--removed";
    prefix = "- ";
  }
  return (
    <>
      {lines.map((line, index) => (
        <span key={index} className={className} data-change={prefix.trim() === "" ? "context" : prefix.trim()}>
          {prefix}
          {line}
          {"\n"}
        </span>
      ))}
    </>
  );
}
