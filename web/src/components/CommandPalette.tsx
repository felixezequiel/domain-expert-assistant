import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  readonly labelKey: string;
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
  const { t } = useTranslation();
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
      { labelKey: "nav.links.home", to: "/", icon: LayoutDashboard, group: "Go to" },
      { labelKey: "nav.links.search", to: "/search", icon: Search, group: "Go to" },
      { labelKey: "nav.links.catalog", to: "/catalog", icon: BookOpen, group: "Go to" },
    ];
    if (capabilities.canCurate) {
      list.push({ labelKey: "nav.links.items", to: "/items", icon: FileText, group: "Go to" });
      list.push({ labelKey: "nav.links.upload", to: "/upload", icon: Upload, group: "Go to" });
      list.push({ labelKey: "nav.search.newItem", to: "/items/new", icon: Plus, group: "Create" });
    }
    if (capabilities.canReview) {
      list.push({ labelKey: "nav.links.reviewQueue", to: "/review", icon: ClipboardCheck, group: "Go to" });
    }
    if (capabilities.canAudit) {
      list.push({ labelKey: "nav.links.audit", to: "/audit", icon: ScrollText, group: "Go to" });
    }
    if (capabilities.canAdminister) {
      list.push({ labelKey: "nav.links.settings", to: "/settings", icon: Settings, group: "Go to" });
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
        <span className="hidden flex-1 text-left sm:inline">{t("nav.search.placeholder")}</span>
        <kbd className="hidden rounded border border-border bg-muted px-1.5 font-mono text-[0.7rem] text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={t("nav.search.placeholder")} />
        <CommandList>
          <CommandEmpty>{t("nav.search.noMatches")}</CommandEmpty>
          {GROUP_ORDER.map((group) => {
            const inGroup = commands.filter((command) => command.group === group);
            if (inGroup.length === 0) {
              return null;
            }
            const heading = group === "Go to" ? t("nav.search.groupGoTo") : t("nav.search.groupCreate");
            return (
              <CommandGroup key={group} heading={heading}>
                {inGroup.map((command) => {
                  const Icon = command.icon;
                  const label = t(command.labelKey);
                  return (
                    <CommandItem key={command.to} value={label} onSelect={() => select(command.to)}>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {label}
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
