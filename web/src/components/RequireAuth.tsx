import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.tsx";

// Gate for the authenticated area: with no in-memory session, bounce to login.
// (Session lives only in memory per ADR-023, so a hard refresh returns here.)
export function RequireAuth({ children }: { readonly children: ReactNode }): JSX.Element {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
