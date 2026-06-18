import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { cn } from "../lib/utils.ts";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover.tsx";

export interface TaxonomyOption {
  readonly value: string;
  readonly label: string;
}

interface TaxonomyComboboxProps {
  readonly options: ReadonlyArray<TaxonomyOption>;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** When provided, a "Create '<query>'" row lets the user add an option without leaving. */
  readonly onCreate?: ((label: string) => Promise<TaxonomyOption>) | undefined;
  readonly placeholder?: string | undefined;
  readonly searchPlaceholder?: string | undefined;
  readonly emptyText?: string | undefined;
  readonly disabled?: boolean | undefined;
  /** Associates an external <Label htmlFor> with the trigger. */
  readonly id?: string | undefined;
  readonly ariaLabel?: string | undefined;
}

// A single-select combobox (Popover + cmdk) for picking a collection. With `onCreate` it
// becomes the in-context creation surface the curator was missing — type a new name and
// "Create '<name>'" makes it without a detour to Settings (the new option is appended by the
// caller so it resolves immediately). Without `onCreate` it is a richer, searchable filter.
export function TaxonomyCombobox({
  options,
  value,
  onChange,
  onCreate,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  id,
  ariaLabel,
}: TaxonomyComboboxProps): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const selected = options.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLowerCase();
  // cmdk's built-in filter is disabled so we can host the "Create" row ourselves and control
  // exactly which options match (case-insensitive substring on the label).
  const matches = options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  const exactMatch = options.some((option) => option.label.trim().toLowerCase() === normalizedQuery);
  const canCreate = onCreate !== undefined && normalizedQuery !== "" && !exactMatch;

  const choose = (next: string): void => {
    onChange(next);
    setOpen(false);
    setQuery("");
  };

  const create = async (): Promise<void> => {
    if (onCreate === undefined || creating) {
      return;
    }
    setCreating(true);
    try {
      const created = await onCreate(query.trim());
      choose(created.value);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          id={id}
          aria-label={ariaLabel}
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            selected === undefined && "text-muted-foreground",
          )}
        >
          <span className="line-clamp-1 text-left">{selected?.label ?? placeholder ?? ""}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder={searchPlaceholder ?? placeholder} />
          <CommandList>
            {matches.length === 0 && !canCreate ? (
              <CommandEmpty>{emptyText ?? t("common.combobox.empty")}</CommandEmpty>
            ) : null}
            {matches.length > 0 ? (
              <CommandGroup>
                {matches.map((option) => (
                  <CommandItem key={option.value} value={option.value} onSelect={() => choose(option.value)}>
                    <Check className={cn("h-4 w-4", option.value === value ? "opacity-100" : "opacity-0")} />
                    <span className="line-clamp-1">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {canCreate ? (
              <CommandGroup>
                <CommandItem value={`__create__${query}`} onSelect={() => void create()} disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  <span className="line-clamp-1">{t("common.combobox.create", { query: query.trim() })}</span>
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
