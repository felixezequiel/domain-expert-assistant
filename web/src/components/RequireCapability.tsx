import type { ReactNode } from "react";
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
  const capabilities = useCapabilities();
  if (!capabilities[capability]) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Not permitted</h2>
        <p className="text-sm text-muted-foreground">
          Your role can&apos;t access this area. If you think this is a mistake, ask an administrator.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
