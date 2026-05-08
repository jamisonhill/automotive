import type {
  FuelEntry,
  ServiceEntry,
  TireSet,
  Vehicle,
} from "@prisma/client";

/*
 * Per-vehicle analytics — lifetime totals, cost-per-mile breakdown,
 * total cost of ownership.
 *
 * All math is done on a single "lifetime miles" denominator so the per-
 * dimension cost-per-mile values add up to the total. The alternative
 * (fuel cost over fuel miles, service cost over lifetime miles, etc.)
 * is more "correct" per category but produces a breakdown that no
 * longer sums to the headline. For an at-a-glance dashboard, summing
 * to the headline is more important than per-category purity.
 *
 * Lifetime miles definition (in priority order):
 *   1. currentMiles - vehicle.purchaseMileage  (when both set)
 *   2. max(odometer) - min(odometer) across all OdometerReading rows
 *   3. null  (no data; analytics returns nulls for $/mi)
 *
 * We do NOT amortize tire-set cost across miles-on-set — the user
 * picked "amortized" but the simplest amortization is just summing all
 * tire-set costs and dividing by lifetime miles, same shape as fuel +
 * service. Set-by-set wear math is a future enhancement (would need
 * miles-on-set per row).
 */

export interface AnalyticsTotals {
  /** Lifetime miles driven on this vehicle (see definition above). */
  lifetimeMiles: number | null;
  /** Sum of FuelEntry.totalCost across all fuel entries. */
  fuelTotal: number;
  /** Sum of ServiceEntry total cost (totalCost, falling back to parts+labor). */
  serviceTotal: number;
  /** Sum of TireSet.cost across every tire set with a recorded cost. */
  tireTotal: number;
  /** fuelTotal + serviceTotal + tireTotal — the operating spend. */
  operatingTotal: number;

  /** Operating cost ÷ lifetime miles, broken out per category and total. */
  costPerMileFuel: number | null;
  costPerMileService: number | null;
  costPerMileTires: number | null;
  costPerMileTotal: number | null;

  /** Vehicle.purchasePrice (passthrough — null when not recorded). */
  purchasePrice: number | null;
  /** purchasePrice + operatingTotal. Null when purchasePrice is missing. */
  totalCostOfOwnership: number | null;
  /** Years between purchaseDate and now. Null when no purchaseDate. */
  yearsOwned: number | null;
  /** TCO ÷ yearsOwned. Null when either piece is missing. */
  costPerYear: number | null;
}

/**
 * Compute the lifetime miles denominator. Helper extracted so the page
 * can also surface the value as a "Lifetime miles" stat without
 * recomputing.
 */
export function computeLifetimeMiles(
  vehicle: Pick<Vehicle, "purchaseMileage">,
  odometerReadings: { miles: number }[]
): number | null {
  if (odometerReadings.length === 0) return null;

  // Highest odometer reading is "current". We use the max across all
  // readings (not just the latest by date) to defend against backdated
  // entries that might be lower than older recorded miles.
  const maxMiles = odometerReadings.reduce(
    (m, r) => (r.miles > m ? r.miles : m),
    0
  );

  // Prefer purchaseMileage as the floor since it's the user's stated
  // start of ownership. Fall back to min odometer reading.
  const minMiles =
    vehicle.purchaseMileage ??
    odometerReadings.reduce(
      (m, r) => (r.miles < m ? r.miles : m),
      odometerReadings[0].miles
    );

  const driven = maxMiles - minMiles;
  return driven > 0 ? driven : null;
}

/**
 * Sum a service entry's cost. Prefers the explicit totalCost field;
 * falls back to (parts + labor) when only the breakdown is filled in.
 */
function serviceEntryCost(e: Pick<ServiceEntry, "totalCost" | "partsCost" | "laborCost">): number {
  if (e.totalCost != null) return e.totalCost;
  return (e.partsCost ?? 0) + (e.laborCost ?? 0);
}

export function summarizeAnalytics(input: {
  vehicle: Pick<Vehicle, "purchaseMileage" | "purchasePrice" | "purchaseDate">;
  odometerReadings: { miles: number }[];
  fuelEntries: Pick<FuelEntry, "totalCost">[];
  serviceEntries: Pick<ServiceEntry, "totalCost" | "partsCost" | "laborCost">[];
  tireSets: Pick<TireSet, "cost">[];
  now?: Date;
}): AnalyticsTotals {
  const now = input.now ?? new Date();

  const lifetimeMiles = computeLifetimeMiles(
    input.vehicle,
    input.odometerReadings
  );

  const fuelTotal = input.fuelEntries.reduce(
    (s, e) => s + (e.totalCost ?? 0),
    0
  );
  const serviceTotal = input.serviceEntries.reduce(
    (s, e) => s + serviceEntryCost(e),
    0
  );
  const tireTotal = input.tireSets.reduce((s, t) => s + (t.cost ?? 0), 0);
  const operatingTotal = fuelTotal + serviceTotal + tireTotal;

  // Per-mile values only meaningful when we have a denominator.
  const safeDiv = (n: number) =>
    lifetimeMiles != null && lifetimeMiles > 0 ? n / lifetimeMiles : null;

  const purchasePrice = input.vehicle.purchasePrice ?? null;
  const totalCostOfOwnership =
    purchasePrice != null ? purchasePrice + operatingTotal : null;

  // Years owned: fractional, rounded to 1 decimal at the display layer.
  let yearsOwned: number | null = null;
  if (input.vehicle.purchaseDate) {
    const ms = now.getTime() - input.vehicle.purchaseDate.getTime();
    const years = ms / (1000 * 60 * 60 * 24 * 365.25);
    if (years > 0) yearsOwned = years;
  }
  const costPerYear =
    totalCostOfOwnership != null && yearsOwned != null && yearsOwned > 0
      ? totalCostOfOwnership / yearsOwned
      : null;

  return {
    lifetimeMiles,
    fuelTotal,
    serviceTotal,
    tireTotal,
    operatingTotal,
    costPerMileFuel: safeDiv(fuelTotal),
    costPerMileService: safeDiv(serviceTotal),
    costPerMileTires: safeDiv(tireTotal),
    costPerMileTotal: safeDiv(operatingTotal),
    purchasePrice,
    totalCostOfOwnership,
    yearsOwned,
    costPerYear,
  };
}

// -----------------------------------------------------------------------------
// Year-over-year breakdown (Phase 7b)
// -----------------------------------------------------------------------------

export interface YearTotals {
  /** Calendar year, e.g., 2026. */
  year: number;
  fuelTotal: number;
  serviceTotal: number;
  tireTotal: number;
  /** fuelTotal + serviceTotal + tireTotal. */
  operatingTotal: number;
  /** Miles driven in this year (max - min odometer reading inside the year),
   *  null when fewer than two readings landed in the year. */
  milesDriven: number | null;
  /** operatingTotal ÷ milesDriven; null when miles unknown or zero. */
  costPerMile: number | null;
}

/**
 * Group every row by calendar year of its event date and emit one row
 * per year that has any activity. Years without activity are omitted
 * (we don't pad gaps — a missing year was likely a partial year of
 * ownership, not a year of zero spend).
 *
 * Tire-set cost is attributed to the year the set was installed; this
 * is a simplification (a $400 set on Dec 30 is allocated entirely to
 * that year even though it'll wear into the next). For monthly trend
 * accuracy we'd need miles-on-set math; for YoY this is good enough.
 */
export function summarizeYearOverYear(input: {
  fuelEntries: { totalCost: number | null; filledAt: Date }[];
  serviceEntries: {
    totalCost: number | null;
    partsCost: number | null;
    laborCost: number | null;
    performedAt: Date;
  }[];
  tireSets: { cost: number | null; installedAt: Date }[];
  odometerReadings: { miles: number; recordedAt: Date }[];
}): YearTotals[] {
  // Year -> running totals. Map keys preserve insertion order, but we
  // sort at the end so ordering doesn't depend on which source wrote
  // first.
  const byYear = new Map<
    number,
    { fuel: number; service: number; tires: number }
  >();
  const ensure = (y: number) => {
    let row = byYear.get(y);
    if (!row) {
      row = { fuel: 0, service: 0, tires: 0 };
      byYear.set(y, row);
    }
    return row;
  };

  for (const e of input.fuelEntries) {
    ensure(e.filledAt.getFullYear()).fuel += e.totalCost ?? 0;
  }
  for (const e of input.serviceEntries) {
    const cost = e.totalCost ?? (e.partsCost ?? 0) + (e.laborCost ?? 0);
    ensure(e.performedAt.getFullYear()).service += cost;
  }
  for (const t of input.tireSets) {
    ensure(t.installedAt.getFullYear()).tires += t.cost ?? 0;
  }

  // Group odometer readings by year so we can compute miles-driven-in-year.
  const readingsByYear = new Map<number, number[]>();
  for (const r of input.odometerReadings) {
    const y = r.recordedAt.getFullYear();
    const list = readingsByYear.get(y) ?? [];
    list.push(r.miles);
    readingsByYear.set(y, list);
  }

  const result: YearTotals[] = [];
  for (const [year, totals] of byYear.entries()) {
    const operatingTotal = totals.fuel + totals.service + totals.tires;
    const readings = readingsByYear.get(year) ?? [];
    const milesDriven =
      readings.length >= 2
        ? Math.max(...readings) - Math.min(...readings)
        : null;
    const costPerMile =
      milesDriven != null && milesDriven > 0
        ? operatingTotal / milesDriven
        : null;
    result.push({
      year,
      fuelTotal: totals.fuel,
      serviceTotal: totals.service,
      tireTotal: totals.tires,
      operatingTotal,
      milesDriven,
      costPerMile,
    });
  }

  // Most recent year first — matches the "headline up top" reading order
  // used elsewhere in the app.
  result.sort((a, b) => b.year - a.year);
  return result;
}
