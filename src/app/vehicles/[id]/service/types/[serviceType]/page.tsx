import { ChevronRight, History } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { serviceLabel } from "@/lib/service-types";

/*
 * Component history view — every entry of one serviceType for a single
 * vehicle, with miles- and days-between stats. Linked to from each entry's
 * service-type label on the main service log.
 *
 * "custom" service types are excluded — the customLabel field varies row
 * to row, so two "custom" entries don't necessarily refer to the same
 * component. The list page omits the link for custom rows.
 */
export default async function ServiceTypeHistoryPage({
  params,
}: {
  params: Promise<{ id: string; serviceType: string }>;
}) {
  const { id, serviceType } = await params;
  const userId = await requireUserId();

  // Custom types intentionally don't have a stable history view — each
  // custom entry might be a different thing entirely.
  if (serviceType === "custom") notFound();

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, userId, isActive: true },
    select: { id: true, year: true, make: true, model: true, nickname: true },
  });
  if (!vehicle) notFound();

  // Pull oldest-first so we can compute deltas in a single pass.
  const entries = await prisma.serviceEntry.findMany({
    where: { vehicleId: id, serviceType },
    orderBy: { performedAt: "asc" },
  });
  if (entries.length === 0) notFound();

  // Per-entry interval: miles and days since the previous occurrence of
  // the same service type. Null on the first (oldest) entry.
  const intervals = entries.map((entry, i) => {
    if (i === 0) {
      return { entry, milesSincePrev: null, daysSincePrev: null };
    }
    const prev = entries[i - 1];
    return {
      entry,
      milesSincePrev: entry.odometer - prev.odometer,
      daysSincePrev: Math.round(
        (entry.performedAt.getTime() - prev.performedAt.getTime()) /
          (1000 * 60 * 60 * 24)
      ),
    };
  });

  // Aggregate stats across all the deltas (i.e., excluding the first entry).
  const deltas = intervals.filter((i) => i.milesSincePrev != null);
  const avgMiles =
    deltas.length > 0
      ? deltas.reduce((s, i) => s + (i.milesSincePrev ?? 0), 0) / deltas.length
      : null;
  const avgDays =
    deltas.length > 0
      ? deltas.reduce((s, i) => s + (i.daysSincePrev ?? 0), 0) / deltas.length
      : null;
  const totalSpent = entries.reduce((s, e) => s + (e.totalCost ?? 0), 0);
  const lastEntry = entries[entries.length - 1];

  // Display newest first; stat cards summarize the whole timeline.
  const display = [...intervals].reverse();

  const label = serviceLabel(serviceType, null);

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title={label}
        subtitle={
          vehicle.nickname ?? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        }
        backHref={`/vehicles/${id}/service`}
      />

      {/* Stat grid — counts + averages */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <StatCard
          label="Times done"
          value={String(entries.length)}
          subtitle={`Last: ${formatDate(lastEntry.performedAt)}`}
        />
        <StatCard
          label="Total spent"
          value={`$${formatNum(totalSpent, 2)}`}
          subtitle={
            entries.filter((e) => e.totalCost != null).length === 0
              ? "—"
              : `${entries.filter((e) => e.totalCost != null).length} priced`
          }
        />
        {avgMiles != null && (
          <StatCard
            label="Avg miles between"
            value={`${Math.round(avgMiles).toLocaleString()} mi`}
            subtitle={`${deltas.length} interval${deltas.length === 1 ? "" : "s"}`}
          />
        )}
        {avgDays != null && (
          <StatCard
            label="Avg time between"
            value={formatAvgTime(avgDays)}
            subtitle={`~${Math.round(avgDays)} days`}
          />
        )}
      </div>

      {/* Per-entry timeline */}
      <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fg-secondary">
        <History className="h-3.5 w-3.5" />
        Timeline
      </h2>
      <div className="space-y-2">
        {display.map(({ entry, milesSincePrev, daysSincePrev }) => (
          <Link
            key={entry.id}
            href={`/vehicles/${id}/service/${entry.id}/edit`}
            className="block"
          >
            <Card className="flex items-center gap-3 p-3 active:bg-bg-overlay">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold text-fg-primary">
                    {formatDate(entry.performedAt)}
                  </p>
                  <p className="text-xs text-fg-muted shrink-0">
                    {entry.odometer.toLocaleString()} mi
                  </p>
                </div>
                <p className="text-xs text-fg-secondary">
                  {entry.totalCost != null
                    ? `$${entry.totalCost.toFixed(2)}`
                    : "—"}{" "}
                  · {entry.diy ? "DIY" : (entry.shopName ?? "Shop")}
                  {entry.partBrand ? ` · ${entry.partBrand}` : ""}
                </p>
                {milesSincePrev != null && daysSincePrev != null && (
                  <p className="mt-1 text-xs text-accent">
                    +{milesSincePrev.toLocaleString()} mi ·{" "}
                    {formatDelta(daysSincePrev)} since previous
                  </p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-fg-muted" />
            </Card>
          </Link>
        ))}
      </div>
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

function formatNum(n: number, digits = 0): string {
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

/**
 * Human-friendly "miles between" delta. Picks the most natural unit:
 *   < 60 days → "N days"
 *   < 730 days → "N mo" (months ≈ days / 30)
 *   else → "N yr" (years ≈ days / 365)
 */
function formatAvgTime(days: number): string {
  if (days < 60) return `${Math.round(days)} days`;
  if (days < 730) return `${Math.round(days / 30)} mo`;
  return `${(days / 365).toFixed(1)} yr`;
}

function formatDelta(days: number): string {
  if (days < 60) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 730) return `${Math.round(days / 30)} mo`;
  return `${(days / 365).toFixed(1)} yr`;
}
