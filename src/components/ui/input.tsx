import * as React from "react";

import { cn } from "@/lib/utils";

/*
 * Input — full-width text input tuned for iPhone Safari.
 * - 16px font prevents the auto-zoom on focus that iOS does for smaller fonts
 * - h-12 = 48px, comfortable thumb target
 * - inputMode/pattern hints should be set by the caller for numeric inputs
 *   (e.g. inputMode="decimal" for gallons, inputMode="numeric" for odometer)
 */
const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-12 w-full rounded-md bg-bg-elevated border border-border-subtle " +
          "px-3 py-2 text-base text-fg-primary placeholder:text-fg-muted " +
          "transition-colors " +
          "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent " +
          "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
