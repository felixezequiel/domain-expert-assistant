import { CalendarIcon } from "lucide-react";
import { Button } from "./ui/button.tsx";
import { Calendar } from "./ui/calendar.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover.tsx";
import { cn } from "../lib/utils.ts";
import { formatDate } from "../lib/format.ts";

// A shadcn date field: a button trigger opening a Calendar in a Popover (replaces the native
// <input type="datetime-local"> default browser picker). Day granularity — the caller maps
// the chosen day to whatever time-window boundary it needs.
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  id,
  ariaLabel,
}: {
  readonly value: Date | null;
  onChange(next: Date | null): void;
  readonly placeholder?: string;
  readonly id?: string;
  readonly ariaLabel?: string;
}): JSX.Element {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          className={cn("w-full justify-start gap-2 font-normal", value === null ? "text-muted-foreground" : null)}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          {value !== null ? formatDate(value.toISOString()) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={(day) => onChange(day ?? null)}
          initialFocus
        />
        {value !== null ? (
          <div className="border-t border-border p-2">
            <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => onChange(null)}>
              Clear
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
