import type { ReactNode } from "react";
import { ApiError } from "../api/ApiError.ts";

// Renders a friendly message for the common auth/validation failure shapes, so every
// screen handles 401/403/400 consistently (the apiClient throws ApiError).
export function ErrorNotice({ error }: { readonly error: unknown }): JSX.Element {
  if (error instanceof ApiError) {
    if (error.isForbidden) {
      return <p className="notice notice--error">Not permitted: your role cannot perform this action.</p>;
    }
    if (error.isUnauthorized) {
      return <p className="notice notice--error">Your session expired. Please log in again.</p>;
    }
    return <p className="notice notice--error">{error.message}</p>;
  }
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return <p className="notice notice--error">{message}</p>;
}

export function Loading(): JSX.Element {
  return <p className="notice">Loading…</p>;
}

export function AsyncBoundary({
  loading,
  error,
  children,
}: {
  readonly loading: boolean;
  readonly error: unknown;
  readonly children: ReactNode;
}): JSX.Element {
  if (loading) {
    return <Loading />;
  }
  if (error !== null && error !== undefined) {
    return <ErrorNotice error={error} />;
  }
  return <>{children}</>;
}
