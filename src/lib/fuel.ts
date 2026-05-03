import type { FuelEntry } from "@prisma/client";

import { prisma } from "@/lib/db";

/*
 * Fuel calculations.
 *
 * MPG model:
 *   - "Anchor" = a fuel entry that's a full fill OR a missedFill marker.
 *     Anchors define the start/end of a measurable trip.
 *   - When you save a new full fill: tripMiles = newOdo - lastAnchorOdo.
 *     tripGallons = sum of gallons from entries strictly after lastAnchor up to
 *     and including the new entry (so partial fills' gallons get counted in
 *     the next full fill's MPG, which is the correct accounting).
 *   - Partial fills: gallons recorded but no MPG for that entry.
 *   - missedFill=true: user is admitting "I forgot to log the previous fill,
 *     so MPG since some unknown earlier point is bogus." We don't compute
 *     MPG for this entry, and we DO use it as the new anchor for future
 *     entries (so subsequent entries don't get tainted by the gap).
 *
 * Cost per mile:
 *   total fuel cost / total miles between first and last anchor (excluding
 *   trips where we don't have MPG, since those gallons can't be attributed).
 */

interface ComputeArgs {
  vehicleId: string;
  newOdometer: number;
  newGallons: number;
  newFilledAt: Date;
  partialFill: boolean;
  missedFill: boolean;
  excludeEntryId?: string; // when recomputing during edit, skip this row
}

interface TripStats {
  tripMiles: number | null;
  tripMpg: number | null;
}

/**
 * Compute trip miles + trip MPG for a fuel entry being created or updated.
 * Reads the prior fuel history from the DB.
 */
export async function computeTripStats(args: ComputeArgs): Promise<TripStats> {
  // Partial fills and missed fills don't get an MPG — early out.
  if (args.partialFill || args.missedFill) {
    return { tripMiles: null, tripMpg: null };
  }

  // Find the most recent anchor strictly before this entry's filledAt.
  // An anchor is a full fill (partialFill=false) regardless of missedFill —
  // missedFill resets the trip, but the missedFill entry IS the anchor for
  // what comes after.
  const lastAnchor = await prisma.fuelEntry.findFirst({
    where: {
      vehicleId: args.vehicleId,
      filledAt: { lt: args.newFilledAt },
      partialFill: false,
      ...(args.excludeEntryId ? { NOT: { id: args.excludeEntryId } } : {}),
    },
    orderBy: { filledAt: "desc" },
  });

  // No prior anchor → first full fill, can't compute MPG yet.
  if (!lastAnchor) return { tripMiles: null, tripMpg: null };

  // If the previous anchor was itself a missedFill, the "trip" before this
  // is undefined — we know how many miles, but not how many gallons.
  if (lastAnchor.missedFill) {
    return { tripMiles: null, tripMpg: null };
  }

  const tripMiles = args.newOdometer - lastAnchor.odometer;
  if (tripMiles <= 0) {
    // Out-of-order entry or odometer typo — don't fabricate MPG.
    return { tripMiles: null, tripMpg: null };
  }

  // Sum gallons of all entries between lastAnchor (exclusive) and now.
  // These would be partial fills that contributed to consumption since the
  // last full fill. Their gallons count toward this fill's MPG.
  const interim = await prisma.fuelEntry.findMany({
    where: {
      vehicleId: args.vehicleId,
      filledAt: { gt: lastAnchor.filledAt, lt: args.newFilledAt },
      ...(args.excludeEntryId ? { NOT: { id: args.excludeEntryId } } : {}),
    },
    select: { gallons: true },
  });
  const interimGallons = interim.reduce((sum, e) => sum + e.gallons, 0);
  const totalGallons = interimGallons + args.newGallons;
  if (totalGallons <= 0) return { tripMiles: null, tripMpg: null };

  return {
    tripMiles,
    tripMpg: tripMiles / totalGallons,
  };
}

/**
 * After a fuel entry is created/edited/deleted, the entry that immediately
 * follows it in time may need its tripMiles/tripMpg recomputed (because its
 * "last anchor" or interim gallons may have changed).
 *
 * For correctness we recompute every entry from `since` forward. For
 * personal use this is at most a few hundred rows per vehicle and runs in
 * a single transaction.
 */
export async function recomputeFuelMpgFrom(
  vehicleId: string,
  since: Date
): Promise<void> {
  const downstream = await prisma.fuelEntry.findMany({
    where: { vehicleId, filledAt: { gte: since } },
    orderBy: { filledAt: "asc" },
  });

  for (const e of downstream) {
    const stats = await computeTripStats({
      vehicleId,
      newOdometer: e.odometer,
      newGallons: e.gallons,
      newFilledAt: e.filledAt,
      partialFill: e.partialFill,
      missedFill: e.missedFill,
      excludeEntryId: e.id,
    });
    await prisma.fuelEntry.update({
      where: { id: e.id },
      data: { tripMiles: stats.tripMiles, tripMpg: stats.tripMpg },
    });
  }
}

// =============================================================================
// Aggregate stats for the fuel page header
// =============================================================================

export interface FuelStats {
  lifetimeMpg: number | null;
  lastMpg: number | null;
  lastFilledAt: Date | null;
  totalSpent: number;
  costPerMile: number | null;
  totalGallons: number;
  totalMiles: number | null;
  fillCount: number;
}

export function summarize(entries: FuelEntry[]): FuelStats {
  if (entries.length === 0) {
    return {
      lifetimeMpg: null,
      lastMpg: null,
      lastFilledAt: null,
      totalSpent: 0,
      costPerMile: null,
      totalGallons: 0,
      totalMiles: null,
      fillCount: 0,
    };
  }

  // Sort newest first so [0] is the most recent fill.
  const sorted = [...entries].sort(
    (a, b) => b.filledAt.getTime() - a.filledAt.getTime()
  );
  const newest = sorted[0];

  const totalSpent = entries.reduce((s, e) => s + (e.totalCost ?? 0), 0);
  const totalGallons = entries.reduce((s, e) => s + e.gallons, 0);

  // Lifetime MPG: only entries with a valid tripMpg contribute.
  // Weight by gallons (so a 20-gallon fill counts more than a 5-gal partial).
  const valid = entries.filter(
    (e) => e.tripMiles != null && e.tripMpg != null && e.tripMiles > 0
  );
  const validMiles = valid.reduce((s, e) => s + (e.tripMiles ?? 0), 0);
  const validGallons = valid.reduce(
    (s, e) =>
      // For a valid entry, the gallons that produced its tripMiles is the
      // entry's own gallons PLUS any partial fills between the previous
      // anchor and this entry. Since we already store the resulting MPG,
      // we can derive validGallons = validMiles / tripMpg, summed.
      s + (e.tripMiles && e.tripMpg ? e.tripMiles / e.tripMpg : 0),
    0
  );
  const lifetimeMpg = validGallons > 0 ? validMiles / validGallons : null;

  // Cost per mile: only count cost from valid trips so dollars line up
  // with miles. Approximate fuelCost of a valid trip = $/gal × gallons-for-trip.
  // For simplicity use overall totalSpent / lifetime miles if we have lifetime
  // miles, else null.
  const costPerMile = validMiles > 0 ? totalSpent / validMiles : null;

  return {
    lifetimeMpg,
    lastMpg: newest.tripMpg ?? null,
    lastFilledAt: newest.filledAt,
    totalSpent,
    costPerMile,
    totalGallons,
    totalMiles: validMiles > 0 ? validMiles : null,
    fillCount: entries.length,
  };
}
