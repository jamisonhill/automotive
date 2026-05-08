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
