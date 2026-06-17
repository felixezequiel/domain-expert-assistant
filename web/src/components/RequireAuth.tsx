import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.tsx";

// Gate for the authenticated area. While the boot cookie-probe is in flight we render a
// neutral loader instead of redirecting, so a hard refresh of a signed-in user no longer
// bounces to /login (finding U3). Once resolved, an empty session redirects to login.
export function RequireAuth({ children }: { readonly children: ReactNode }): JSX.Element {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
