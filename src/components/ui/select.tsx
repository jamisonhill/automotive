import * as React from "react";

import { cn } from "@/lib/utils";

/*
 * Select — uses the native <select> on iPhone Safari, which gives us the
 * full-screen iOS picker wheel for free. That's the single best UX for
 * picking from a list on a phone — better than any custom dropdown.
 *
 * Styled to match Input. The down-chevron is a CSS background-image so we
 * keep the native picker behavior on tap.
 */
const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        "flex h-12 w-full appearance-none rounded-md bg-bg-elevated " +
          "border border-border-subtle px-3 pr-9 py-2 text-base text-fg-primary " +
          "transition-colors " +
          "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent " +
          "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      // SVG chevron in fg-secondary color, positioned at right
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23a1a1a6' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.5rem center",
        backgroundSize: "1.5em 1.5em",
      }}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = "Select";

export { Select };
