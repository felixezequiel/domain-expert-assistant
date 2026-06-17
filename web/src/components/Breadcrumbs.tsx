import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  readonly label: string;
  // A link target for every crumb except the current (last) one, which renders as plain text.
  readonly to?: string;
}

// A small trail so detail screens say where they sit ("Items › Edit", "Catalog › <title>")
// and offer a one-click way back up, instead of relying only on the sidebar.
export function Breadcrumbs({ items }: { readonly items: ReadonlyArray<Crumb> }): JSX.Element {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <Fragment key={index}>
            {index > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" /> : null}
            {item.to !== undefined && !isLast ? (
              <Link to={item.to} className="transition-colors hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium text-foreground" : undefined}>{item.label}</span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
