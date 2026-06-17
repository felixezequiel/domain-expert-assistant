import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { ApiError } from "../api/ApiError.ts";
import { cn } from "../lib/utils.ts";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isForbidden) {
      return "Not permitted: your role cannot perform this action.";
    }
    if (error.isUnauthorized) {
      return "Your session expired. Please log in again.";
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

// Renders a friendly message for the common auth/validation failure shapes, so every
// screen handles 401/403/400 consistently (the apiClient throws ApiError).
export function ErrorNotice({
  error,
  className,
}: {
  readonly error: unknown;
  readonly className?: string;
}): JSX.Element {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <span className="text-foreground/90">{errorMessage(error)}</span>
    </div>
  );
}

export function Loading(): JSX.Element {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading…
    </div>
  );
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
