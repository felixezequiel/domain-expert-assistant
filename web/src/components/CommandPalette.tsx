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
import { itemsApi } from "../api/resources.ts";
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
interface JumpItem {
  readonly id: string;
  readonly title: string;
  readonly status: string;
}

export function CommandPalette(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ReadonlyArray<JumpItem>>([]);
  const [itemsLoaded, setItemsLoaded] = useState(false);
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

  // Items power "jump straight to a doc by name" — what distinguishes ⌘K (navigate anywhere)
  // from the Search page (full-text over published content). Fetched lazily the first time the
  // palette opens so a page load doesn't pay for it; failures degrade to no item rows.
  useEffect(() => {
    if (!open || itemsLoaded) {
      return;
    }
    let cancelled = false;
    void itemsApi
      .list()
      .then((response) => {
        if (!cancelled) {
          setItems(response.items.map((item) => ({ id: item.id, title: item.title, status: item.status })));
          setItemsLoaded(true);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, itemsLoaded]);

  const openItem = (id: string): void => {
    setOpen(false);
    navigate(capabilities.canCurate ? `/items/${id}` : `/catalog/${id}`);
  };

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
          {items.length > 0 ? (
            <CommandGroup heading={t("nav.search.groupItems")}>
              {items.map((item) => (
                <CommandItem key={item.id} value={item.title} onSelect={() => openItem(item.id)}>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{item.title}</span>
                  <span className="text-xs text-muted-foreground">{t("common.status." + item.status)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  );
}
