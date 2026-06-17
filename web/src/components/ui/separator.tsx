import * as React from "react";

import { cn } from "@/lib/utils";

export interface SeparatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref,
  ) => {
    const isVertical = orientation === "vertical";

    let role: "none" | "separator" = "separator";
    if (decorative) {
      role = "none";
    }

    let ariaOrientation: "horizontal" | "vertical" | undefined;
    if (!decorative) {
      ariaOrientation = isVertical ? "vertical" : "horizontal";
    }

    return (
      <div
        ref={ref}
        role={role}
        aria-orientation={ariaOrientation}
        className={cn(
          "shrink-0 bg-border",
          isVertical ? "h-full w-px" : "h-px w-full",
          className,
        )}
        {...props}
      />
    );
  },
);
Separator.displayName = "Separator";

export { Separator };
