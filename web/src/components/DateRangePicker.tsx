import { CalendarIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type DateRange } from "react-day-picker";
import { Button } from "./ui/button.tsx";
import { Calendar } from "./ui/calendar.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover.tsx";
import { cn } from "../lib/utils.ts";
import { formatDate } from "../lib/format.ts";

// A single shadcn date-range field: one trigger + one Calendar (mode="range", two months).
// Replaces a pair of separate from/to date inputs. Day granularity — the caller maps the
// chosen days to whatever time-window boundaries it needs.
export function DateRangePicker({
  value,
  onChange,
  placeholder,
  id,
  ariaLabel,
}: {
  readonly value: DateRange | undefined;
  onChange(next: DateRange | undefined): void;
  readonly placeholder?: string;
  readonly id?: string;
  readonly ariaLabel?: string;
}): JSX.Element {
  const { t } = useTranslation();
  let label = placeholder ?? t("audit.dateRange.pick");
  if (value?.from !== undefined && value.to !== undefined) {
    label = formatDate(value.from.toISOString()) + " – " + formatDate(value.to.toISOString());
  } else if (value?.from !== undefined) {
    label = formatDate(value.from.toISOString());
  }
  const hasSelection = value?.from !== undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          className={cn("w-full justify-start gap-2 font-normal", hasSelection ? null : "text-muted-foreground")}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={(range) => onChange(range)}
          numberOfMonths={2}
          initialFocus
        />
        {hasSelection ? (
          <div className="border-t border-border p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => onChange(undefined)}
            >
              {t("audit.dateRange.clear")}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
