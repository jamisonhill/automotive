import type { Reminder, ServiceEntry } from "@prisma/client";

import { addMonths } from "@/lib/warranties";

/*
 * Reminder status computation.
 *
 * A Reminder describes a service that recurs on an interval (miles
 * and/or months). Both dimensions are independent — whichever expires
 * first triggers the reminder.
 *
 * Effective "last done" comes from two sources, max-merged:
 *   1. The reminder's explicit lastDoneMiles / lastDoneAt fields (manual
 *      overrides — useful when work was done before tracking started).
 *   2. The most recent ServiceEntry whose serviceType matches the
 *      reminder's serviceType. Auto-advances forward as service rows
 *      land (the service action wires this up in Phase 6b; the engine
 *      also computes it on read so display stays correct even before
 *      the auto-advance commits).
 *
 * Status buckets (mirrors the warranty engine's three-state pattern):
 *   - "overdue"  — at least one dimension has hit zero
 *   - "due_soon" — within DUE_SOON_DAYS or DUE_SOON_MILES of due
 *   - "ok"       — both dimensions still have meaningful runway
 *   - "no_data"  — can't compute either dimension (missing lastDone
 *                  AND no matching ServiceEntry; or no current odometer
 *                  for the miles dimension when only that one is set)
 */

/** Within 30 days = "due soon" — about a month, the canonical buffer. */
export const DUE_SOON_DAYS = 30;
/** Within 500 mi = "due soon" — roughly a week of normal driving. */
export const DUE_SOON_MILES = 500;

export type ReminderStatus = "overdue" | "due_soon" | "ok" | "no_data";

export interface ReminderComputed {
  reminder: Reminder;
  /** Effective last-done miles after merging explicit + ServiceEntry data. */
  lastDoneMiles: number | null;
  /** Effective last-done date after merging explicit + ServiceEntry data. */
  lastDoneAt: Date | null;
  /** Mileage at which this reminder is due, or null if not computable. */
  dueMiles: number | null;
  /** Date at which this reminder is due, or null if not computable. */
  dueDate: Date | null;
  /** Miles to go (negative = overdue). Null when not computable. */
  milesRemaining: number | null;
  /** Days to go (negative = overdue). Null when not computable. */
  daysRemaining: number | null;
  status: ReminderStatus;
}

/**
 * Pull effective lastDone fields by merging the reminder's explicit
 * overrides with any matching ServiceEntry rows. The merge is
 * "max-only": explicit fields can't be regressed by older service
 * entries, but newer service entries DO advance the reminder forward.
 */
export function resolveLastDone(
  reminder: Pick<Reminder, "lastDoneMiles" | "lastDoneAt">,
  matchingServiceEntries: Pick<ServiceEntry, "performedAt" | "odometer">[]
): { miles: number | null; at: Date | null } {
  let miles: number | null = reminder.lastDoneMiles ?? null;
  let at: Date | null = reminder.lastDoneAt ?? null;

  for (const e of matchingServiceEntries) {
    // Service entries always have an odometer (it's required) and a
    // performedAt date; advance whichever is newer.
    if (miles == null || e.odometer > miles) miles = e.odometer;
    if (at == null || e.performedAt > at) at = e.performedAt;
  }

  return { miles, at };
}

/**
 * Compute the full status of one reminder. Pure function — caller is
 * responsible for fetching matching ServiceEntry rows (typically
 * filtered by `serviceType`). Pass `now` explicitly in tests to keep
 * results deterministic.
 */
export function computeReminderStatus(
  reminder: Reminder,
  matchingServiceEntries: Pick<ServiceEntry, "performedAt" | "odometer">[],
  currentMiles: number | null,
  now: Date = new Date()
): ReminderComputed {
  const { miles: lastDoneMiles, at: lastDoneAt } = resolveLastDone(
    reminder,
    matchingServiceEntries
  );

  // Due points — computable only when we have both an interval and a
  // baseline ("last done") for that dimension.
  const dueMiles =
    reminder.intervalMiles != null && lastDoneMiles != null
      ? lastDoneMiles + reminder.intervalMiles
      : null;
  const dueDate =
    reminder.intervalMonths != null && lastDoneAt != null
      ? addMonths(lastDoneAt, reminder.intervalMonths)
      : null;

  // Remaining — miles dimension also needs the current odometer.
  const milesRemaining =
    dueMiles != null && currentMiles != null
      ? dueMiles - currentMiles
      : null;
  const daysRemaining =
    dueDate != null
      ? Math.round(
          (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )
      : null;

  // Status decision: overdue beats due_soon beats ok. "no_data" only
  // fires when neither dimension produced a remaining number.
  let status: ReminderStatus;
  if (milesRemaining == null && daysRemaining == null) {
    status = "no_data";
  } else if (
    (milesRemaining != null && milesRemaining <= 0) ||
    (daysRemaining != null && daysRemaining <= 0)
  ) {
    status = "overdue";
  } else if (
    (milesRemaining != null && milesRemaining <= DUE_SOON_MILES) ||
    (daysRemaining != null && daysRemaining <= DUE_SOON_DAYS)
  ) {
    status = "due_soon";
  } else {
    status = "ok";
  }

  return {
    reminder,
    lastDoneMiles,
    lastDoneAt,
    dueMiles,
    dueDate,
    milesRemaining,
    daysRemaining,
    status,
  };
}

/**
 * Sort key for "most urgent first" ordering on the reminders list.
 * Mirrors warranties.ts/expirationSortKey: combine days + miles into
 * one comparable scalar by treating ~10 mi as equivalent to 1 day.
 */
export function urgencySortKey(c: ReminderComputed): number {
  const m = c.milesRemaining;
  const d = c.daysRemaining;
  if (m != null && d != null) return Math.min(d, m / 10);
  if (d != null) return d;
  if (m != null) return m / 10 + 10000;
  return Number.POSITIVE_INFINITY;
}
