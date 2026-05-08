import { ChevronRight, History, Plus, Receipt, Wrench } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { serviceLabel } from "@/lib/service-types";

/*
 * Service log — entry point for everything maintenance / repair related.
 *
 * Layout:
 *   - Stats: total spent (lifetime), entry count, last service date
 *   - List grouped by year, newest first
 *   - "+" CTA to add a new entry
 *
 * The grouping isn't a fancy timeline yet — Phase 4d will add per-component
 * history. For now this is a simple chronological log.
 */
export default async function ServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, isActive: true },
    select: { id: true, year: true, make: true, model: true, nickname: true },
  });
  if (!vehicle) notFound();

  const entries = await prisma.serviceEntry.findMany({
    where: { vehicleId: id },
    orderBy: { performedAt: "desc" },
  });

  // Roll up totals for the stats grid. We only count entries that have a
  // total cost — DIY-with-parts-only and free inspections shouldn't skew
  // the "total spent" figure when the parts/labor split was never entered.
  const totalSpent = entries.reduce(
    (sum, e) => sum + (e.totalCost ?? 0),
    0
  );
  const lastEntry = entries[0] ?? null;

  // Group by year for a readable scan. Map preserves insertion order.
  const byYear = new Map<number, typeof entries>();
  for (const e of entries) {
    const yr = e.performedAt.getFullYear();
    if (!byYear.has(yr)) byYear.set(yr, []);
    byYear.get(yr)!.push(e);
  }

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Service & repairs"
        subtitle={
          vehicle.nickname ?? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        }
        backHref={`/vehicles/${vehicle.id}`}
        actions={
          // Two sibling buttons in the header actions slot: the
          // receipts gallery shortcut, then the primary "Add" CTA.
          <div className="flex items-center gap-1">
            <Link href={`/vehicles/${vehicle.id}/receipts`}>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Receipts gallery"
              >
                <Receipt className="h-4 w-4" />
              </Button>
            </Link>
            <Link href={`/vehicles/${vehicle.id}/service/new`}>
              <Button variant="primary" size="sm" aria-label="Add service entry">
                <Plus className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        }
      />

      {/* Stats grid */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <StatCard
          label="Entries"
          value={String(entries.length)}
          subtitle={
            lastEntry
              ? `Last: ${formatDate(lastEntry.performedAt)}`
              : "No entries yet"
          }
        />
        <StatCard
          label="Total spent"
          value={`$${fmtNum(totalSpent, 2)}`}
          subtitle={
            entries.filter((e) => e.totalCost != null).length === 0
              ? "—"
              : `${entries.filter((e) => e.totalCost != null).length} priced`
          }
        />
      </div>

      {/* Entry list */}
      {entries.length === 0 ? (
        <Card className="py-10 text-center">
          <Wrench className="mx-auto mb-3 h-8 w-8 text-fg-muted" />
          <p className="mb-4 text-fg-secondary">No service entries yet.</p>
          <Link href={`/vehicles/${vehicle.id}/service/new`}>
            <Button>
              <Plus className="h-4 w-4" />
              Add service
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {Array.from(byYear.entries()).map(([year, list]) => (
            <div key={year} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">
                {year}
              </h2>
              {list.map((e) => {
                // Custom entries don't roll up into a meaningful history
                // (each customLabel could refer to a different thing).
                // Only catalog-typed entries get a history link on the
                // service-type label.
                const hasHistory = e.serviceType !== "custom";
                const label = serviceLabel(e.serviceType, e.customLabel);
                return (
                  <Card key={e.id} className="overflow-hidden p-0">
                    {/* Title row — type label is the link to component
                        history; date sits beside it as plain text. */}
                    <div className="flex items-baseline justify-between gap-2 px-3 pt-3">
                      {hasHistory ? (
                        <Link
                          href={`/vehicles/${vehicle.id}/service/types/${e.serviceType}`}
                          className="inline-flex items-center gap-1 font-semibold text-fg-primary truncate hover:text-accent active:text-accent"
                        >
                          <span className="truncate">{label}</span>
                          <History className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
                        </Link>
                      ) : (
                        <span className="font-semibold text-fg-primary truncate">
                          {label}
                        </span>
                      )}
                      <span className="text-xs text-fg-muted shrink-0">
                        {formatDate(e.performedAt)}
                      </span>
                    </div>
                    {/* Body row — links to the edit page. */}
                    <Link
                      href={`/vehicles/${vehicle.id}/service/${e.id}/edit`}
                      className="flex items-center gap-3 px-3 pb-3 pt-1 active:bg-bg-overlay"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-fg-secondary">
                          {e.odometer.toLocaleString()} mi ·{" "}
                          {e.totalCost != null
                            ? `$${e.totalCost.toFixed(2)}`
                            : "—"}{" "}
                          · {e.diy ? "DIY" : (e.shopName ?? "Shop")}
                        </p>
                        {e.partBrand && (
                          <p className="text-xs text-fg-muted truncate">
                            {[e.partBrand, e.partNumber]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-fg-muted" />
                    </Link>
                  </Card>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <Card className="p-3">
      <p className="text-[10px] uppercase tracking-wider text-fg-muted">
        {label}
      </p>
      <p className="text-xl font-bold text-fg-primary">{value}</p>
      {subtitle && (
        <p className="text-[11px] text-fg-secondary truncate">{subtitle}</p>
      )}
    </Card>
  );
}

function fmtNum(n: number, digits = 0): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "2-digit",
  });
}
