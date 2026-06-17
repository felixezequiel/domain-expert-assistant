import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";
import { useCapabilities } from "../auth/AuthContext.tsx";
import type { Capabilities } from "../auth/capabilities.ts";

// Client-side authorization for admin/auditor routes (finding S1). The server still enforces
// every action (ADR-011), but direct navigation to a screen the role can't use should show a
// clear "Not permitted" page rather than rendering admin controls that only fail on submit.
export function RequireCapability({
  capability,
  children,
}: {
  readonly capability: keyof Capabilities;
  readonly children: ReactNode;
}): JSX.Element {
  const { t } = useTranslation();
  const capabilities = useCapabilities();
  if (!capabilities[capability]) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{t("nav.notPermitted.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("nav.notPermitted.description")}</p>
      </div>
    );
  }
  return <>{children}</>;
}
