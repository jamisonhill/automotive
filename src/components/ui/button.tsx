import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

/*
 * Button variants — primary (accent-blue CTA), secondary (subtle on dark),
 * ghost (no fill, used for nav/utility), danger (destructive actions).
 *
 * Sizes default to "md" which is finger-friendly on iPhone (44pt touch target).
 * "lg" is for primary CTAs at the bottom of forms.
 */
const buttonVariants = cva(
  // Base styles applied to every button
  "inline-flex items-center justify-center gap-2 rounded-md font-medium " +
    "transition-colors duration-150 active:scale-[0.98] " +
    "disabled:pointer-events-none disabled:opacity-40 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-accent-fg hover:bg-accent-hover " +
          "shadow-[0_1px_2px_rgba(0,0,0,0.4)]",
        secondary:
          "bg-bg-elevated text-fg-primary hover:bg-bg-overlay " +
          "border border-border-subtle",
        ghost: "bg-transparent text-fg-primary hover:bg-bg-elevated",
        danger:
          "bg-danger text-white hover:bg-danger/90 " +
          "shadow-[0_1px_2px_rgba(0,0,0,0.4)]",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-base", // 44pt — Apple's minimum touch target
        lg: "h-14 px-6 text-lg w-full", // full-width primary CTA
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
