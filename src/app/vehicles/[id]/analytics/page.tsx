import { TrendingUp } from "lucide-react";
import { notFound } from "next/navigation";

import { Sparkline } from "@/components/sparkline";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import {
  summarizeAnalytics,
  summarizeYearOverYear,
  type YearTotals,
} from "@/lib/analytics";
import { prisma } from "@/lib/db";

/*
 * Vehicle analytics — lifetime numbers (Phase 7a).
 *
 * Layout:
 *   - Hero: lifetime miles + total cost-per-mile
 *   - Operating spend table: fuel / service / tires with $/mi each
 *   - TCO card (only when purchasePrice is set): purchase + ops = total
 *
 * Phase 7b will add time-series charts (MPG trend, monthly spend, YoY).
 */
export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // One round-trip: pull every row needed for analytics totals. Volume
  // per vehicle is small (≤ a few hundred rows total), so loading them
  // all is fine. We only select the columns the math needs.
  const [vehicle, fuelEntries, serviceEntries, tireSets, odometerReadings] =
    await Promise.all([
      prisma.vehicle.findFirst({
        where: { id, isActive: true },
        select: {
          id: true,
          year: true,
          make: true,
          model: true,
          nickname: true,
          purchaseMileage: true,
          purchasePrice: true,
          purchaseDate: true,
        },
      }),
      prisma.fuelEntry.findMany({
        where: { vehicleId: id },
        select: {
          totalCost: true,
          filledAt: true,
          tripMpg: true,
          tripMiles: true,
        },
        orderBy: { filledAt: "asc" },
      }),
      prisma.serviceEntry.findMany({
        where: { vehicleId: id },
        select: {
          totalCost: true,
          partsCost: true,
          laborCost: true,
          performedAt: true,
        },
      }),
      prisma.tireSet.findMany({
        where: { vehicleId: id },
        select: { cost: true, installedAt: true },
      }),
      prisma.odometerReading.findMany({
        where: { vehicleId: id },
        select: { miles: true, recordedAt: true },
      }),
    ]);
  if (!vehicle) notFound();

  const totals = summarizeAnalytics({
    vehicle,
    fuelEntries,
    serviceEntries,
    tireSets,
    odometerReadings,
  });

  const yearly = summarizeYearOverYear({
    fuelEntries,
    serviceEntries,
    tireSets,
    odometerReadings,
  });

  // MPG sparkline data — only valid full fills contribute (tripMpg null
  // for partials and the first fill ever). Use filledAt epoch as x so
  // the line spaces points by real elapsed time, not entry index.
  const mpgPoints = fuelEntries
    .filter(
      (e): e is typeof e & { tripMpg: number } =>
        e.tripMpg != null && e.tripMiles != null && e.tripMiles > 0
    )
    .map((e) => ({ x: e.filledAt.getTime(), y: e.tripMpg }));

  const noData =
    totals.lifetimeMiles == null && totals.operatingTotal === 0;

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Analytics"
        subtitle={
          vehicle.nickname ?? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        }
        backHref={`/vehicles/${vehicle.id}`}
      />

      {noData ? (
        <Card className="py-10 text-center">
          <TrendingUp className="mx-auto mb-3 h-8 w-8 text-fg-muted" />
          <p className="text-fg-secondary">
            No data yet. Log fuel, service, or odometer readings and the
            numbers will start showing here.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Hero stats */}
          <Card className="p-0 overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-border-subtle">
              <Stat
                label="Lifetime miles"
                value={
                  totals.lifetimeMiles != null
                    ? `${fmtNum(totals.lifetimeMiles)}`
                    : "—"
                }
                subtitle="driven on this car"
              />
              <Stat
                label="$ / mile"
                value={
                  totals.costPerMileTotal != null
                    ? `$${totals.costPerMileTotal.toFixed(3)}`
                    : "—"
                }
                subtitle={
                  totals.costPerMileTotal != null
                    ? "all-in operating cost"
                    : "need miles + spend"
                }
              />
            </div>
          </Card>

          {/* MPG trend sparkline — only render when there's at least
              one valid full-fill data point to plot. */}
          {mpgPoints.length > 0 && (
            <Card>
              <div className="flex items-baseline justify-between">
                <CardTitle className="text-base">MPG trend</CardTitle>
                <span className="text-xs text-fg-muted">
                  {mpgPoints.length} fill
                  {mpgPoints.length === 1 ? "" : "s"}
                </span>
              </div>
              <CardDescription>
                Per-fill MPG over time. Partial fills excluded.
              </CardDescription>
              <div className="mt-3">
                <Sparkline data={mpgPoints} height={80} />
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-fg-muted">
                <span>
                  {new Date(mpgPoints[0].x).toLocaleDateString(undefined, {
                    month: "short",
                    year: "2-digit",
                  })}
                </span>
                <span>
                  {totals.costPerMileFuel != null && (
                    <>lifetime ${totals.costPerMileFuel.toFixed(3)}/mi</>
                  )}
                </span>
                <span>
                  {new Date(
                    mpgPoints[mpgPoints.length - 1].x
                  ).toLocaleDateString(undefined, {
                    month: "short",
                    year: "2-digit",
                  })}
                </span>
              </div>
            </Card>
          )}

          {/* Operating spend breakdown */}
          <Card>
            <CardTitle className="text-base mb-1">Operating cost</CardTitle>
            <CardDescription>
              Everything you've spent driving the car since you've owned it.
            </CardDescription>
            <div className="mt-3 divide-y divide-border-subtle">
              <SpendRow
                label="Fuel"
                total={totals.fuelTotal}
                perMile={totals.costPerMileFuel}
              />
              <SpendRow
                label="Service"
                total={totals.serviceTotal}
                perMile={totals.costPerMileService}
              />
              <SpendRow
                label="Tires"
                total={totals.tireTotal}
                perMile={totals.costPerMileTires}
              />
              <SpendRow
                label="Total"
                total={totals.operatingTotal}
                perMile={totals.costPerMileTotal}
                emphasis
              />
            </div>
          </Card>

          {/* TCO — only when purchasePrice is set */}
          {totals.purchasePrice != null && totals.totalCostOfOwnership != null && (
            <Card>
              <CardTitle className="text-base mb-1">
                Total cost of ownership
              </CardTitle>
              <CardDescription>
                Purchase price plus everything you've spent on the car.
              </CardDescription>
              <div className="mt-3 divide-y divide-border-subtle">
                <SpendRow
                  label="Purchase price"
                  total={totals.purchasePrice}
                />
                <SpendRow
                  label="Operating cost"
                  total={totals.operatingTotal}
                />
                <SpendRow
                  label="Total"
                  total={totals.totalCostOfOwnership}
                  emphasis
                />
                {totals.yearsOwned != null && totals.costPerYear != null && (
                  <div className="flex items-baseline justify-between py-2 text-xs text-fg-muted">
                    <span>
                      {totals.yearsOwned.toFixed(1)} years owned
                    </span>
                    <span>${fmtNum(totals.costPerYear, 0)} / year</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Year-over-year breakdown — collapses years with any spend
              into a compact table. Skips render when there's only one
              year on file (the YoY framing doesn't add anything). */}
          {yearly.length > 1 && (
            <Card>
              <CardTitle className="text-base mb-1">Year over year</CardTitle>
              <CardDescription>
                Spend totals per calendar year, newest first.
              </CardDescription>
              <div className="mt-3">
                <YearOverYearTable rows={yearly} />
              </div>
            </Card>
          )}
        </div>
      )}
    </main>
  );
}

/**
 * Compact horizontally-scrolling-free table. We intentionally drop the
 * tires column when no year had any tire spend so the row stays
 * readable on a phone — the breakdown card above already covers the
 * lifetime tire total.
 */
function YearOverYearTable({ rows }: { rows: YearTotals[] }) {
  const showTires = rows.some((r) => r.tireTotal > 0);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-wider text-fg-muted">
          <th className="py-1 pr-2">Year</th>
          <th className="py-1 px-2 text-right">Fuel</th>
          <th className="py-1 px-2 text-right">Service</th>
          {showTires && <th className="py-1 px-2 text-right">Tires</th>}
          <th className="py-1 pl-2 text-right">Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border-subtle">
        {rows.map((r) => (
          <tr key={r.year}>
            <td className="py-2 pr-2 font-semibold text-fg-primary">
              {r.year}
            </td>
            <td className="py-2 px-2 text-right tabular-nums text-fg-secondary">
              {r.fuelTotal > 0 ? `$${fmtNum(r.fuelTotal, 0)}` : "—"}
            </td>
            <td className="py-2 px-2 text-right tabular-nums text-fg-secondary">
              {r.serviceTotal > 0 ? `$${fmtNum(r.serviceTotal, 0)}` : "—"}
            </td>
            {showTires && (
              <td className="py-2 px-2 text-right tabular-nums text-fg-secondary">
                {r.tireTotal > 0 ? `$${fmtNum(r.tireTotal, 0)}` : "—"}
              </td>
            )}
            <td className="py-2 pl-2 text-right tabular-nums font-semibold text-fg-primary">
              ${fmtNum(r.operatingTotal, 0)}
              {r.costPerMile != null && (
                <span className="block text-[10px] font-normal text-fg-muted">
                  ${r.costPerMile.toFixed(3)}/mi
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// -----------------------------------------------------------------------------
// Layout helpers
// -----------------------------------------------------------------------------

function Stat({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-fg-muted">
        {label}
      </p>
      <p className="text-base font-semibold text-fg-primary">{value}</p>
      {subtitle && (
        <p className="mt-0.5 text-[11px] text-fg-muted">{subtitle}</p>
      )}
    </div>
  );
}

function SpendRow({
  label,
  total,
  perMile,
  emphasis = false,
}: {
  label: string;
  total: number;
  perMile?: number | null;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between py-2 ${
        emphasis ? "font-semibold text-fg-primary" : "text-fg-secondary"
      }`}
    >
      <span className="text-sm">{label}</span>
      <div className="flex items-baseline gap-3 text-sm">
        <span>${fmtNum(total, 2)}</span>
        {perMile != null && (
          <span
            className={`tabular-nums ${
              emphasis ? "text-fg-primary" : "text-fg-muted"
            } text-xs`}
          >
            ${perMile.toFixed(3)}/mi
          </span>
        )}
      </div>
    </div>
  );
}

function fmtNum(n: number, digits = 0): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
