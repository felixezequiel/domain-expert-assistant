import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils.ts";
import { Card, CardContent } from "./ui/card.tsx";

type Tone = "default" | "warning" | "success";

interface MetricCardProps {
  readonly label: string;
  readonly value: number | string;
  readonly icon: LucideIcon;
  /** When set, the whole card is a link to this route. */
  readonly to?: string | undefined;
  readonly tone?: Tone | undefined;
  /** Optional context line under the value (e.g. "3 awaiting review"). */
  readonly hint?: string | undefined;
}

const VALUE_TONE: Record<Tone, string> = {
  default: "text-foreground",
  warning: "text-warning",
  success: "text-success",
};

const ICON_TONE: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/15 text-success",
};

// A single metric tile: an icon chip, a large tabular value, a label, and an optional hint.
// Links to its detail route when `to` is given, with a hover affordance.
export function MetricCard({ label, value, icon: Icon, to, tone = "default", hint }: MetricCardProps): JSX.Element {
  const card = (
    <Card className={cn("h-full transition-colors", to !== undefined && "hover:border-primary/50")}>
      <CardContent className="flex items-start justify-between gap-3 py-5">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={cn("text-3xl font-semibold tabular-nums", VALUE_TONE[tone])}>{value}</p>
          {hint !== undefined ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", ICON_TONE[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </CardContent>
    </Card>
  );

  if (to === undefined) {
    return card;
  }
  return (
    <Link to={to} className="group block">
      {card}
    </Link>
  );
}
