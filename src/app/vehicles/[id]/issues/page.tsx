import { AlertCircle, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

/*
 * Issues / DTC log — list with status filter.
 *
 * Query string `?status=open|monitoring|resolved` controls the filter.
 * Anything else (or no param) shows all. Filter chips below the header
 * link to the same page with different `status=` values.
 */
type IssueStatus = "open" | "monitoring" | "resolved";

const VALID_STATUSES: IssueStatus[] = ["open", "monitoring", "resolved"];

function isValidStatus(s: string | undefined): s is IssueStatus {
  return s != null && (VALID_STATUSES as string[]).includes(s);
}

export default async function IssuesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();
  const { status: statusParam } = await searchParams;
  const activeFilter = isValidStatus(statusParam) ? statusParam : null;

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, userId, isActive: true },
    select: { id: true, year: true, make: true, model: true, nickname: true },
  });
  if (!vehicle) notFound();

  // Pull all issues so we can compute counts for every filter chip in
  // a single round-trip. With <200 issues per vehicle ever, this is fine;
  // we only filter for display in JS.
  const all = await prisma.issue.findMany({
    where: { vehicleId: id },
    orderBy: [{ status: "asc" }, { reportedAt: "desc" }],
  });

  const counts = {
    all: all.length,
    open: all.filter((i) => i.status === "open").length,
    monitoring: all.filter((i) => i.status === "monitoring").length,
    resolved: all.filter((i) => i.status === "resolved").length,
  };

  const visible = activeFilter
    ? all.filter((i) => i.status === activeFilter)
    : all;

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Issues & DTCs"
        subtitle={
          vehicle.nickname ?? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        }
        backHref={`/vehicles/${vehicle.id}`}
        actions={
          <Link href={`/vehicles/${vehicle.id}/issues/new`}>
            <Button variant="primary" size="sm" aria-label="Add issue">
              <Plus className="h-4 w-4" />
            </Button>
          </Link>
        }
      />

      {/* Filter chips */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <FilterChip
          href={`/vehicles/${vehicle.id}/issues`}
          label="All"
          count={counts.all}
          active={activeFilter == null}
        />
        <FilterChip
          href={`/vehicles/${vehicle.id}/issues?status=open`}
          label="Open"
          count={counts.open}
          active={activeFilter === "open"}
          tone="danger"
        />
        <FilterChip
          href={`/vehicles/${vehicle.id}/issues?status=monitoring`}
          label="Monitoring"
          count={counts.monitoring}
          active={activeFilter === "monitoring"}
          tone="warning"
        />
        <FilterChip
          href={`/vehicles/${vehicle.id}/issues?status=resolved`}
          label="Resolved"
          count={counts.resolved}
          active={activeFilter === "resolved"}
          tone="success"
        />
      </div>

      {visible.length === 0 ? (
        <Card className="py-10 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-fg-muted" />
          <p className="mb-4 text-fg-secondary">
            {activeFilter
              ? `No ${activeFilter} issues.`
              : "No issues logged yet."}
          </p>
          <Link href={`/vehicles/${vehicle.id}/issues/new`}>
            <Button>
              <Plus className="h-4 w-4" />
              Log issue
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((issue) => (
            <Link
              key={issue.id}
              href={`/vehicles/${vehicle.id}/issues/${issue.id}/edit`}
              className="block"
            >
              <Card className="flex items-start gap-3 p-3 active:bg-bg-overlay">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold text-fg-primary line-clamp-2">
                      {issue.symptom}
                    </p>
                    <p className="text-xs text-fg-muted shrink-0">
                      {formatDate(issue.reportedAt)}
                    </p>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <StatusPill status={issue.status as IssueStatus} />
                    {issue.dtcCodes && (
                      <span className="rounded bg-bg-overlay px-1.5 py-0.5 font-mono text-[11px] text-fg-secondary">
                        {issue.dtcCodes}
                      </span>
                    )}
                    {issue.reportedMileage != null && (
                      <span className="text-xs text-fg-muted">
                        {issue.reportedMileage.toLocaleString()} mi
                      </span>
                    )}
                  </div>
                  {issue.diagnosis && (
                    <p className="mt-1 text-xs text-fg-secondary line-clamp-1">
                      {issue.diagnosis}
                    </p>
                  )}
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-fg-muted" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function FilterChip({
  href,
  label,
  count,
  active,
  tone = "default",
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  tone?: "default" | "danger" | "warning" | "success";
}) {
  // Pick the count's color by tone — only when there are issues to show,
  // so an empty "Open" filter doesn't look alarming.
  const toneClass =
    count === 0
      ? "text-fg-muted"
      : tone === "danger"
        ? "text-danger"
        : tone === "warning"
          ? "text-warning"
          : tone === "success"
            ? "text-success"
            : "text-fg-secondary";

  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-accent bg-accent/10 text-fg-primary"
          : "border-border-subtle bg-bg-elevated text-fg-secondary"
      }`}
    >
      <span>{label}</span>
      <span className={`text-xs font-semibold ${toneClass}`}>{count}</span>
    </Link>
  );
}

function StatusPill({ status }: { status: IssueStatus }) {
  const cls =
    status === "open"
      ? "bg-danger/15 text-danger"
      : status === "monitoring"
        ? "bg-warning/15 text-warning"
        : "bg-success/15 text-success";
  const label =
    status === "open"
      ? "Open"
      : status === "monitoring"
        ? "Monitoring"
        : "Resolved";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "2-digit",
  });
}
