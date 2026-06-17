import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router-dom";
import { cn } from "../lib/utils.ts";

// Organization settings live behind ONE "Settings" entry rather than five loose sidebar
// links: members, taxonomy, API access and governance are all the same behaviour ("configure
// my org"), so they're grouped on one screen with a sub-tab bar (finding: semantic IA).
const TABS: ReadonlyArray<{ readonly to: string; readonly labelKey: string }> = [
  { to: "/settings/members", labelKey: "admin.settings.tabs.members" },
  { to: "/settings/collections", labelKey: "admin.settings.tabs.collections" },
  { to: "/settings/tags", labelKey: "admin.settings.tabs.tags" },
  { to: "/settings/credentials", labelKey: "admin.settings.tabs.credentials" },
  { to: "/settings/policy", labelKey: "admin.settings.tabs.policy" },
];

export function SettingsLayout(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin.settings.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.settings.subtitle")}</p>
      </div>

      <div className="border-b border-border">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )
              }
            >
              {t(tab.labelKey)}
            </NavLink>
          ))}
        </nav>
      </div>

      <Outlet />
    </div>
  );
}
