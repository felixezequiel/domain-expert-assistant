import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth, useCapabilities } from "../auth/AuthContext.tsx";

interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly visible: boolean;
}

// Role-gated navigation. Visibility is a UX hint only (ADR-023): the curator/reviewer/
// consumer sections are open to any authenticated session because their endpoints are not
// role-gated at read time, while the Admin and Audit sections are shown only when the
// post-login capability probe confirmed access. The server's authorization is still the
// authoritative gate — hidden links never imply security.
export function Layout(): JSX.Element {
  const { session, logout } = useAuth();
  const capabilities = useCapabilities();
  const navigate = useNavigate();

  const items: ReadonlyArray<NavItem> = [
    { to: "/search", label: "Search", visible: true },
    { to: "/catalog", label: "Catalog", visible: true },
    { to: "/items", label: "Items", visible: true },
    { to: "/upload", label: "Upload", visible: true },
    { to: "/review", label: "Review queue", visible: true },
    { to: "/audit", label: "Audit trail", visible: capabilities.canAudit },
    { to: "/admin/users", label: "Users", visible: capabilities.canAdminister },
    { to: "/admin/collections", label: "Collections", visible: capabilities.canAdminister },
    { to: "/admin/tags", label: "Tags", visible: capabilities.canAdminister },
    { to: "/admin/credentials", label: "Credentials", visible: capabilities.canAdminister },
    { to: "/admin/policy", label: "Org policy", visible: capabilities.canAdminister },
  ];

  const handleLogout = async (): Promise<void> => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="layout">
      <aside className="layout__sidebar">
        <h1 className="layout__brand">Domain Expert</h1>
        <nav>
          <ul>
            {items
              .filter((item) => item.visible)
              .map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to}>{item.label}</NavLink>
                </li>
              ))}
          </ul>
        </nav>
      </aside>
      <div className="layout__main">
        <header className="layout__topbar">
          <span className="layout__user">{session?.userId ?? ""}</span>
          <button type="button" onClick={() => void handleLogout()}>
            Log out
          </button>
        </header>
        <main className="layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
