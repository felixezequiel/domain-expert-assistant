import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2 } from "lucide-react";
import { ApiError } from "../api/ApiError.ts";
import { cn } from "../lib/utils.ts";

// Renders a friendly message for the common auth/validation failure shapes, so every
// screen handles 401/403/400 consistently (the apiClient throws ApiError). The client-side
// shapes are translated; a server-provided message is shown as-is (the backend is English).
export function ErrorNotice({
  error,
  className,
}: {
  readonly error: unknown;
  readonly className?: string;
}): JSX.Element {
  const { t } = useTranslation();
  let message: string;
  if (error instanceof ApiError) {
    if (error.isForbidden) {
      message = t("common.errors.forbidden");
    } else if (error.isUnauthorized) {
      message = t("common.errors.sessionExpired");
    } else {
      message = error.message;
    }
  } else if (error instanceof Error) {
    message = error.message;
  } else {
    message = t("common.errors.generic");
  }
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <span className="text-foreground/90">{message}</span>
    </div>
  );
}

export function Loading(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {t("common.loading")}
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
