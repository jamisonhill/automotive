import { prisma } from "@/lib/db";

/*
 * advanceMatchingReminders — when a ServiceEntry is created or updated,
 * persistently advance any active Reminder that tracks the same
 * serviceType. We update lastDoneMiles and lastDoneAt only when the new
 * value is strictly greater than what's stored, so a service-entry edit
 * that lowers mileage or backdates the time can never regress a reminder.
 *
 * Why two updateMany calls instead of one:
 *   Each dimension (miles vs at) needs its own forward-only filter.
 *   Prisma's updateMany can't express a per-row CASE that mixes both
 *   conditions, so we run them as two single-statement updates. Doing the
 *   forward-only check in SQL (rather than read-then-write) avoids a race
 *   window when two saves happen in quick succession.
 *
 * Custom service entries are skipped: every "custom" entry refers to a
 * different thing, so no reminder will ever match by serviceType anyway.
 */
export async function advanceMatchingReminders(
  vehicleId: string,
  serviceType: string,
  odometer: number,
  performedAt: Date
): Promise<void> {
  // Custom entries don't share a serviceType with anything else.
  if (serviceType === "custom") return;

  // Bump lastDoneMiles forward only.
  await prisma.reminder.updateMany({
    where: {
      vehicleId,
      serviceType,
      isActive: true,
      OR: [{ lastDoneMiles: null }, { lastDoneMiles: { lt: odometer } }],
    },
    data: { lastDoneMiles: odometer },
  });

  // Bump lastDoneAt forward only.
  await prisma.reminder.updateMany({
    where: {
      vehicleId,
      serviceType,
      isActive: true,
      OR: [{ lastDoneAt: null }, { lastDoneAt: { lt: performedAt } }],
    },
    data: { lastDoneAt: performedAt },
  });
}
