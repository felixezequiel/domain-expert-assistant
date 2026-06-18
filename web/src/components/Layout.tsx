import { useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ScrollText,
  Search,
  Settings,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { useAuth, useCapabilities } from "../auth/AuthContext.tsx";
import { cn } from "../lib/utils.ts";
import { CommandPalette } from "./CommandPalette.tsx";
import { LanguageSwitcher } from "./LanguageSwitcher.tsx";
import { Avatar, AvatarFallback } from "./ui/avatar.tsx";
import { Button } from "./ui/button.tsx";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu.tsx";

interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly visible: boolean;
  // Exact-match active state (for "/" so it isn't active on every nested route).
  readonly end?: boolean;
}

interface NavSection {
  readonly heading: string | null;
  readonly items: ReadonlyArray<NavItem>;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  const first = parts[0]![0] ?? "";
  if (parts.length === 1) {
    return first.toUpperCase();
  }
  const last = parts[parts.length - 1]![0] ?? "";
  return (first + last).toUpperCase();
}

export function Layout(): JSX.Element {
  const { t } = useTranslation();
  const { session, logout } = useAuth();
  const capabilities = useCapabilities();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Nav visibility is a UX hint tailored to the session's roles (ADR-023). The server's
  // authorization is the authoritative gate (RequireCapability guards the routes too).
  const sections: ReadonlyArray<NavSection> = [
    {
      heading: null,
      items: [
        { to: "/", label: t("nav.links.home"), icon: LayoutDashboard, visible: true, end: true },
        { to: "/search", label: t("nav.links.search"), icon: Search, visible: true },
        { to: "/catalog", label: t("nav.links.catalog"), icon: BookOpen, visible: true },
      ],
    },
    {
      heading: t("nav.sections.curation"),
      items: [
        { to: "/items", label: t("nav.links.items"), icon: FileText, visible: capabilities.canCurate },
        { to: "/upload", label: t("nav.links.upload"), icon: Upload, visible: capabilities.canCurate },
        { to: "/review", label: t("nav.links.reviewQueue"), icon: ClipboardCheck, visible: capabilities.canReview },
      ],
    },
    {
      heading: t("nav.sections.administration"),
      items: [
        { to: "/audit", label: t("nav.links.audit"), icon: ScrollText, visible: capabilities.canAudit },
        { to: "/settings", label: t("nav.links.settings"), icon: Settings, visible: capabilities.canAdminister },
      ],
    },
  ];

  const visibleSections = sections
    .map((section) => ({ ...section, items: section.items.filter((item) => item.visible) }))
    .filter((section) => section.items.length > 0);

  const handleLogout = async (): Promise<void> => {
    await logout();
    navigate("/login");
  };

  const displayName = session?.user.displayName ?? "";
  const email = session?.user.email ?? "";

  const nav = (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {visibleSections.map((section) => (
        <div key={section.heading ?? "main"} className="space-y-1">
          {section.heading !== null ? (
            <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {section.heading}
            </p>
          ) : null}
          {section.items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end === true}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    "before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-full before:bg-primary before:opacity-0 before:transition-opacity",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground before:opacity-100"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow-sm ring-1 ring-inset ring-white/10">
        DE
      </span>
      <span className="font-display text-base font-semibold tracking-tight text-foreground">Domain Expert</span>
    </div>
  );

  // A persistent primary "Create" entry so authoring is always one click from anywhere —
  // it consolidates the two ways to create an item (write / upload a document) that used to
  // be separate nav links. Curators only (UX hint; the server still authorizes).
  const createNav = capabilities.canCurate ? (
    <div className="px-3 pt-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="w-full justify-start gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            {t("nav.create.button")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem
            onClick={() => {
              setMobileOpen(false);
              navigate("/items/new");
            }}
          >
            <FileText className="mr-2 h-4 w-4" />
            {t("nav.create.newItem")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setMobileOpen(false);
              navigate("/upload");
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            {t("nav.create.uploadDocument")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ) : null;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        {brand}
        {createNav}
        {nav}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/80 px-4 backdrop-blur">
          {/* Mobile navigation drawer */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("nav.openMenu")}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-sidebar p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>{t("nav.navigation")}</SheetTitle>
              </SheetHeader>
              {brand}
              {createNav}
              {nav}
            </SheetContent>
          </Sheet>
          <CommandPalette />
          <div className="flex-1" />
          <LanguageSwitcher />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs font-semibold">{initials(displayName)}</AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium sm:inline">{displayName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{displayName}</span>
                  <span className="text-xs font-normal text-muted-foreground">{email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void handleLogout()}>
                <LogOut className="mr-2 h-4 w-4" />
                {t("nav.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
          <div key={location.pathname} className="animate-page-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
