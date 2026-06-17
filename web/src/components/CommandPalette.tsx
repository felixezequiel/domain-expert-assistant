import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Plus,
  ScrollText,
  Search,
  Settings,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { useCapabilities } from "../auth/AuthContext.tsx";
import { Button } from "./ui/button.tsx";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command.tsx";

interface PaletteCommand {
  readonly label: string;
  readonly to: string;
  readonly icon: LucideIcon;
  readonly group: "Go to" | "Create";
}

const GROUP_ORDER = ["Go to", "Create"] as const;

// A ⌘K / Ctrl+K command palette for fast navigation across the console. Commands are filtered
// by the session's capabilities (same UX-hint contract as the nav). Rendered once, in the
// top bar, so it is available on every authenticated screen.
export function CommandPalette(): JSX.Element {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const capabilities = useCapabilities();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const commands = useMemo<ReadonlyArray<PaletteCommand>>(() => {
    const list: Array<PaletteCommand> = [
      { label: "Home", to: "/", icon: LayoutDashboard, group: "Go to" },
      { label: "Search", to: "/search", icon: Search, group: "Go to" },
      { label: "Catalog", to: "/catalog", icon: BookOpen, group: "Go to" },
    ];
    if (capabilities.canCurate) {
      list.push({ label: "Items", to: "/items", icon: FileText, group: "Go to" });
      list.push({ label: "Upload", to: "/upload", icon: Upload, group: "Go to" });
      list.push({ label: "New item", to: "/items/new", icon: Plus, group: "Create" });
    }
    if (capabilities.canReview) {
      list.push({ label: "Review queue", to: "/review", icon: ClipboardCheck, group: "Go to" });
    }
    if (capabilities.canAudit) {
      list.push({ label: "Audit trail", to: "/audit", icon: ScrollText, group: "Go to" });
    }
    if (capabilities.canAdminister) {
      list.push({ label: "Settings", to: "/settings", icon: Settings, group: "Go to" });
    }
    return list;
  }, [capabilities]);

  const select = (to: string): void => {
    setOpen(false);
    navigate(to);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 justify-start gap-2 px-2.5 font-normal text-muted-foreground hover:text-foreground sm:w-72"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden flex-1 text-left sm:inline">Search or jump to…</span>
        <kbd className="hidden rounded border border-border bg-muted px-1.5 font-mono text-[0.7rem] text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search or jump to…" />
        <CommandList>
          <CommandEmpty>No matches.</CommandEmpty>
          {GROUP_ORDER.map((group) => {
            const inGroup = commands.filter((command) => command.group === group);
            if (inGroup.length === 0) {
              return null;
            }
            return (
              <CommandGroup key={group} heading={group}>
                {inGroup.map((command) => {
                  const Icon = command.icon;
                  return (
                    <CommandItem key={command.to} value={command.label} onSelect={() => select(command.to)}>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {command.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
