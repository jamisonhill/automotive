import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/*
 * PageHeader — sticky top bar with back link, title, and an optional action slot.
 * Mirrors the iOS NavigationStack header so the app feels native.
 */
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel = "Back",
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-10 -mx-4 mb-4 border-b border-border-subtle " +
          "bg-bg-base/80 px-4 py-3 backdrop-blur-md " +
          "supports-[backdrop-filter]:bg-bg-base/60",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {backHref && (
          <Link
            href={backHref}
            className="-ml-2 flex items-center gap-0.5 rounded-md px-2 py-1 text-accent active:bg-bg-elevated"
            aria-label={backLabel}
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm">{backLabel}</span>
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-base font-semibold text-fg-primary">
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-xs text-fg-secondary">{subtitle}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
