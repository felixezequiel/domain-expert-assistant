import { NavLink, Outlet } from "react-router-dom";
import { cn } from "../lib/utils.ts";

// Organization settings live behind ONE "Settings" entry rather than five loose sidebar
// links: members, taxonomy, API access and governance are all the same behaviour ("configure
// my org"), so they're grouped on one screen with a sub-tab bar (finding: semantic IA).
const TABS: ReadonlyArray<{ readonly to: string; readonly label: string }> = [
  { to: "/settings/members", label: "Members" },
  { to: "/settings/collections", label: "Collections" },
  { to: "/settings/tags", label: "Tags" },
  { to: "/settings/credentials", label: "API credentials" },
  { to: "/settings/policy", label: "Policy" },
];

export function SettingsLayout(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your organization — members, taxonomy, API access and governance.
        </p>
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
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <Outlet />
    </div>
  );
}
