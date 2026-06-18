import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Plus } from "lucide-react";
import { cn } from "../lib/utils.ts";
import { Button } from "./ui/button.tsx";
import { Input } from "./ui/input.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover.tsx";

export interface TagOption {
  readonly id: string;
  readonly label: string;
}

interface TagPickerProps {
  readonly options: ReadonlyArray<TagOption>;
  readonly value: ReadonlyArray<string>;
  readonly onChange: (next: ReadonlyArray<string>) => void;
  /** When provided, an "Add tag" affordance creates a tag without leaving the editor. */
  readonly onCreate?: ((label: string) => Promise<TagOption>) | undefined;
  readonly disabled?: boolean | undefined;
}

// Tags as toggle chips so every option is visible at a glance, plus an inline "Add tag"
// popover that creates a tag on the spot (the curator no longer detours to Settings → Tags).
export function TagPicker({ options, value, onChange, onCreate, disabled }: TagPickerProps): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);

  const toggle = (id: string): void => {
    if (value.includes(id)) {
      onChange(value.filter((current) => current !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const create = async (): Promise<void> => {
    const label = draft.trim();
    if (onCreate === undefined || label === "" || creating) {
      return;
    }
    setCreating(true);
    try {
      const created = await onCreate(label);
      onChange([...value, created.id]);
      setDraft("");
      setOpen(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((tag) => {
        const active = value.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => toggle(tag.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              active
                ? "border-primary/50 bg-primary/15 text-foreground"
                : "border-border text-muted-foreground hover:border-input hover:text-foreground",
            )}
          >
            <Check className={cn("h-3.5 w-3.5", active ? "opacity-100" : "opacity-0")} />
            {tag.label}
          </button>
        );
      })}

      {onCreate !== undefined ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-input px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("common.tagPicker.add")}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-2" align="start">
            <Input
              value={draft}
              autoFocus
              placeholder={t("common.tagPicker.placeholder")}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void create();
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              className="w-full"
              disabled={draft.trim() === "" || creating}
              onClick={() => void create()}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("common.tagPicker.create", { query: draft.trim() })}
            </Button>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
