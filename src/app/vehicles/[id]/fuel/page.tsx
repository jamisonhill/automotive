import { ChevronRight, Fuel, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Sparkline } from "@/components/sparkline";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { summarize } from "@/lib/fuel";

/*
 * Fuel page — entry point for everything fuel-related on a single vehicle.
 *
 * Layout:
 *   - Stats grid: lifetime MPG, last MPG, $/mile, total spent
 *   - Sparkline: MPG over time (uses tripMpg from each entry)
 *   - List of recent fills, tap to edit
 *   - "+" CTA to add a new fill-up
 */
export default async function FuelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, userId, isActive: true },
    select: { id: true, year: true, make: true, model: true, nickname: true },
  });
  if (!vehicle) notFound();

  const entries = await prisma.fuelEntry.findMany({
    where: { vehicleId: id },
    orderBy: { filledAt: "desc" },
  });

  const stats = summarize(entries);

  // Sparkline data: only entries with valid MPG, plotted by date.
  const sparklineData = entries
    .filter((e) => e.tripMpg != null)
    .map((e) => ({ x: e.filledAt.getTime(), y: e.tripMpg as number }));

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Fuel & MPG"
        subtitle={
          vehicle.nickname ?? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        }
        backHref={`/vehicles/${vehicle.id}`}
        actions={
          <Link href={`/vehicles/${vehicle.id}/fuel/new`}>
            <Button variant="primary" size="sm" aria-label="Add fill-up">
              <Plus className="h-4 w-4" />
            </Button>
          </Link>
        }
      />

      {/* Stats grid */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <StatCard
          label="Lifetime MPG"
          value={fmtMpg(stats.lifetimeMpg)}
          subtitle={`${stats.fillCount} fill${stats.fillCount === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Last MPG"
          value={fmtMpg(stats.lastMpg)}
          subtitle={
            stats.lastFilledAt ? formatDate(stats.lastFilledAt) : "—"
          }
        />
        <StatCard
          label="$ / mile"
          value={
            stats.costPerMile != null
              ? `$${stats.costPerMile.toFixed(3)}`
              : "—"
          }
          subtitle={stats.totalMiles ? `over ${fmtNum(stats.totalMiles)} mi` : "—"}
        />
        <StatCard
          label="Total spent"
          value={`$${fmtNum(stats.totalSpent, 2)}`}
          subtitle={`${stats.totalGallons.toFixed(1)} gal`}
        />
      </div>

      {/* MPG trend */}
      {sparklineData.length >= 2 && (
        <Card className="mb-4 p-3">
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">
              MPG trend
            </h2>
            <p className="text-xs text-fg-muted">
              {sparklineData.length} fills
            </p>
          </div>
          <Sparkline data={sparklineData} height={70} />
        </Card>
      )}

      {/* Entry list */}
      {entries.length === 0 ? (
        <Card className="py-10 text-center">
          <Fuel className="mx-auto mb-3 h-8 w-8 text-fg-muted" />
          <p className="mb-4 text-fg-secondary">No fill-ups yet.</p>
          <Link href={`/vehicles/${vehicle.id}/fuel/new`}>
            <Button>
              <Plus className="h-4 w-4" />
              Add fill-up
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-secondary">
            Recent
          </h2>
          {entries.map((e) => (
            <Link
              key={e.id}
              href={`/vehicles/${vehicle.id}/fuel/${e.id}/edit`}
              className="block"
            >
              <Card className="flex items-center gap-3 p-3 active:bg-bg-overlay">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold text-fg-primary">
                      {e.tripMpg != null
                        ? `${e.tripMpg.toFixed(1)} mpg`
                        : e.partialFill
                          ? "Partial"
                          : e.missedFill
                            ? "Missed prior"
                            : "—"}
                    </p>
                    <p className="text-xs text-fg-muted">
                      {formatDate(e.filledAt)}
                    </p>
                  </div>
                  <p className="text-xs text-fg-secondary">
                    {e.gallons.toFixed(2)} gal ·{" "}
                    {e.totalCost != null
                      ? `$${e.totalCost.toFixed(2)}`
                      : "—"}{" "}
                    · {e.odometer.toLocaleString()} mi
                  </p>
                  {e.station && (
                    <p className="text-xs text-fg-muted truncate">
                      {e.station}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-fg-muted" />
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

function fmtMpg(n: number | null): string {
  if (n == null) return "—";
  return `${n.toFixed(1)}`;
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
