import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Label — pairs with form inputs.
 * Always render labels visibly above inputs (not just placeholders) for
 * accessibility and so the user can see what field they're filling in
 * even after typing has begun.
 */
const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-sm font-medium text-fg-secondary mb-1.5 block",
      className
    )}
    {...props}
  />
));
Label.displayName = "Label";

export { Label };
