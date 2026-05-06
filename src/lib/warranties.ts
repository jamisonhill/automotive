import type { ServiceEntry } from "@prisma/client";

/*
 * Warranty status computation.
 *
 * A ServiceEntry has an "active warranty" if either warrantyMonths or
 * warrantyMiles is set. Whichever dimension expires first closes out the
 * warranty:
 *   - months: performedAt + warrantyMonths months
 *   - miles:  odometer  + warrantyMiles  (compared against current odo)
 *
 * Status buckets:
 *   - "active"   — both dimensions still have meaningful runway
 *   - "expiring" — within EXPIRING_DAYS_LEFT or EXPIRING_MILES_LEFT
 *   - "expired"  — at least one dimension has hit zero
 *
 * A warranty with miles tracked but no current odometer reading on file
 * can't compute milesLeft. We fall back to the months dimension (if set)
 * or treat as active.
 */

/** Within 90 days = "expiring soon" (≈3 months — the canonical buffer). */
export const EXPIRING_DAYS_LEFT = 90;
/** Within 2,000 miles = "expiring soon" — enough for a couple weekends. */
export const EXPIRING_MILES_LEFT = 2000;

export type WarrantyStatus = "active" | "expiring" | "expired";

export interface WarrantyComputed {
  entry: ServiceEntry;
  /** Days until months-based expiration, or null if no months tracked. */
  daysLeft: number | null;
  /** Miles until miles-based expiration, or null if not computable. */
  milesLeft: number | null;
  /** Date at which the months dimension expires (null if not tracked). */
  expiresAt: Date | null;
  /** Mileage at which the miles dimension expires (null if not tracked). */
  expiresMileage: number | null;
  status: WarrantyStatus;
}

/**
 * Add N months to a date. JS's Date.setMonth handles the arithmetic and
 * rolls overflow naturally (e.g. Jan 31 + 1 month → Mar 3 because Feb 31
 * doesn't exist). Slight imprecision is acceptable for warranty math.
 */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Compute the warranty status for a single service entry.
 *
 * Returns null when the entry has no warranty data (warrantyMonths AND
 * warrantyMiles both null) — those rows shouldn't appear in the warranty
 * dashboard at all.
 */
export function computeWarrantyStatus(
  entry: ServiceEntry,
  currentMiles: number | null,
  now: Date = new Date()
): WarrantyComputed | null {
  if (entry.warrantyMonths == null && entry.warrantyMiles == null) {
    return null;
  }

  // Months dimension
  let daysLeft: number | null = null;
  let expiresAt: Date | null = null;
  if (entry.warrantyMonths != null) {
    expiresAt = addMonths(entry.performedAt, entry.warrantyMonths);
    daysLeft = Math.round(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // Miles dimension — only computable when we know the current odometer.
  let milesLeft: number | null = null;
  let expiresMileage: number | null = null;
  if (entry.warrantyMiles != null) {
    expiresMileage = entry.odometer + entry.warrantyMiles;
    if (currentMiles != null) {
      milesLeft = expiresMileage - currentMiles;
    }
  }

  // "Expired" wins over "expiring" — either dimension hitting zero closes
  // the warranty regardless of where the other one is.
  const monthsExpired = daysLeft != null && daysLeft <= 0;
  const milesExpired = milesLeft != null && milesLeft <= 0;
  if (monthsExpired || milesExpired) {
    return {
      entry,
      daysLeft,
      milesLeft,
      expiresAt,
      expiresMileage,
      status: "expired",
    };
  }

  // "Expiring soon" if either dimension is below its threshold.
  const monthsExpiring = daysLeft != null && daysLeft <= EXPIRING_DAYS_LEFT;
  const milesExpiring = milesLeft != null && milesLeft <= EXPIRING_MILES_LEFT;
  if (monthsExpiring || milesExpiring) {
    return {
      entry,
      daysLeft,
      milesLeft,
      expiresAt,
      expiresMileage,
      status: "expiring",
    };
  }

  return {
    entry,
    daysLeft,
    milesLeft,
    expiresAt,
    expiresMileage,
    status: "active",
  };
}

/**
 * Sort key for a warranty row — earlier expiration first. Combines both
 * dimensions: pick whichever runs out sooner. We project months → miles
 * via days-per-mile from the vehicle's history? Too much. Simpler: rank
 * by daysLeft when present, else by milesLeft scaled, else infinity.
 */
export function expirationSortKey(w: WarrantyComputed): number {
  // Prefer days-left when we have it. Otherwise, fall back to miles-left
  // scaled by an arbitrary "days per mile" rate so they're comparable
  // (~10 days/mile is not realistic — instead, just put miles-only ones
  // after all months ones with a base offset).
  if (w.daysLeft != null && w.milesLeft != null) {
    return Math.min(w.daysLeft, w.milesLeft / 10);
  }
  if (w.daysLeft != null) return w.daysLeft;
  if (w.milesLeft != null) return w.milesLeft / 10 + 10000;
  return Number.POSITIVE_INFINITY;
}
