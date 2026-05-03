import * as React from "react";

import { cn } from "@/lib/utils";

/*
 * Textarea — multi-line text input.
 * Default min-height is comfortable for ~3 lines on iPhone; users can drag
 * the resize handle if they need more (Safari supports vertical resize).
 */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[88px] w-full rounded-md bg-bg-elevated border border-border-subtle " +
          "px-3 py-2 text-base text-fg-primary placeholder:text-fg-muted " +
          "transition-colors resize-y " +
          "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent " +
          "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
