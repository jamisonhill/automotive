import { TrendingUp } from "lucide-react";
import { notFound } from "next/navigation";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { summarizeAnalytics } from "@/lib/analytics";
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
        select: { totalCost: true },
      }),
      prisma.serviceEntry.findMany({
        where: { vehicleId: id },
        select: { totalCost: true, partsCost: true, laborCost: true },
      }),
      prisma.tireSet.findMany({
        where: { vehicleId: id },
        select: { cost: true },
      }),
      prisma.odometerReading.findMany({
        where: { vehicleId: id },
        select: { miles: true },
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

          {/* Phase 7a hint that more is coming */}
          <p className="px-1 text-center text-[11px] text-fg-muted">
            Trends and charts coming in Phase 7b.
          </p>
        </div>
      )}
    </main>
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
