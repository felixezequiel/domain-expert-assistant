import type { ReactNode } from "react";

interface PageHeaderProps {
  readonly title: string;
  readonly description?: string | undefined;
  /** Right-aligned actions (buttons, links). Wraps under the title on narrow screens. */
  readonly actions?: ReactNode;
}

// One consistent page title block (serif h1 + subtitle + actions slot) so every screen has
// the same rhythm instead of ad-hoc <header>/<h1> markup repeated across pages.
export function PageHeader({ title, description, actions }: PageHeaderProps): JSX.Element {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description !== undefined ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions !== undefined ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
