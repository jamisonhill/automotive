import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { computeReminderStatus } from "@/lib/reminders";
import { requireUserId } from "@/lib/session";
import { computeWarrantyStatus } from "@/lib/warranties";

/*
 * Read helpers used by server components.
 *
 * Every query here is scoped to the current user — listActiveVehicles only
 * returns the caller's garage, getVehicle returns null if the vehicle exists
 * but belongs to someone else (no leakage of cross-user existence).
 *
 * Actions / route handlers that need to confirm ownership before mutating
 * use requireVehicleOwnership() below — it throws a 404 on miss so the
 * miss-vs-not-owned distinction never reaches the client.
 */

/**
 * Active vehicles for the garage list, with the most recent odometer reading
 * pre-loaded so the card can show current mileage without a follow-up query.
 */
export async function listActiveVehicles() {
  const userId = await requireUserId();
  return prisma.vehicle.findMany({
    where: { userId, isActive: true },
    orderBy: [{ createdAt: "asc" }],
    include: {
      odometerReadings: {
        orderBy: { recordedAt: "desc" },
        take: 1,
      },
    },
  });
}

/**
 * Verify the current user owns the given vehicle. Returns the bare Vehicle
 * row on success. Throws notFound() if the vehicle doesn't exist, has been
 * archived, or belongs to another user — server actions and route handlers
 * use this as their gate before any vehicle-scoped write.
 *
 * Using notFound() (404) rather than forbid (403) means we never leak that
 * a given vehicleId exists for some other user.
 */
export async function requireVehicleOwnership(vehicleId: string) {
  const userId = await requireUserId();
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, userId, isActive: true },
  });
  if (!vehicle) notFound();
  return vehicle;
}

/**
 * Single vehicle by id, with the most recent odometer reading, baseline,
 * most recent fuel entry, most recent service entry, and the count of
 * open + monitoring issues so the dashboard can surface a badge. Returns
 * null if the vehicle doesn't exist, has been archived, OR belongs to
 * another user.
 */
export async function getVehicle(id: string) {
  const userId = await requireUserId();
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, userId, isActive: true },
    include: {
      baseline: true,
      odometerReadings: {
        orderBy: { recordedAt: "desc" },
        take: 1,
      },
      fuelEntries: {
        orderBy: { filledAt: "desc" },
        take: 1,
      },
      serviceEntries: {
        orderBy: { performedAt: "desc" },
        take: 1,
      },
      // Currently-installed tire set (if any) for the dashboard tile.
      // At most one row should be returned because the install workflow
      // auto-closes the previous active set, but we still take[1] as a
      // safety net for the auxiliary-active edge case.
      tireSets: {
        where: { removedAt: null },
        orderBy: { installedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!vehicle) return null;

  // Count issues that aren't resolved — this is what the "Issues & DTCs"
  // tile shows as a badge. Cheaper than including the rows.
  const openIssueCount = await prisma.issue.count({
    where: { vehicleId: id, status: { in: ["open", "monitoring"] } },
  });

  // Warranty summary — counts of active / expiring / expired across all
  // service entries with warranty data. The dashboard tile uses these,
  // so we compute once here instead of refetching from the tile.
  const warrantyEntries = await prisma.serviceEntry.findMany({
    where: {
      vehicleId: id,
      OR: [
        { warrantyMonths: { not: null } },
        { warrantyMiles: { not: null } },
      ],
    },
  });
  const currentMiles = vehicle.odometerReadings[0]?.miles ?? null;
  const now = new Date();
  let activeWarranties = 0;
  let expiringWarranties = 0;
  let expiredWarranties = 0;
  for (const e of warrantyEntries) {
    const w = computeWarrantyStatus(e, currentMiles, now);
    if (!w) continue;
    if (w.status === "active") activeWarranties += 1;
    else if (w.status === "expiring") expiringWarranties += 1;
    else expiredWarranties += 1;
  }

  // Reminder summary — counts of active / due-soon / overdue across all
  // active reminders. We compute live status (mirrors the reminders page)
  // because explicit lastDone fields and matching ServiceEntry rows can
  // both shift the bucket. Volume per vehicle is small (≤ 20 even for
  // diligent owners), so the in-memory grouping stays cheap.
  const reminders = await prisma.reminder.findMany({
    where: { vehicleId: id, isActive: true },
  });
  let activeReminders = 0;
  let dueSoonReminders = 0;
  let overdueReminders = 0;
  if (reminders.length > 0) {
    const reminderServiceEntries = await prisma.serviceEntry.findMany({
      where: { vehicleId: id },
      select: { serviceType: true, performedAt: true, odometer: true },
    });
    // Index by serviceType so each reminder pulls its slice in O(1).
    const byType = new Map<
      string,
      { performedAt: Date; odometer: number }[]
    >();
    for (const e of reminderServiceEntries) {
      const list = byType.get(e.serviceType) ?? [];
      list.push({ performedAt: e.performedAt, odometer: e.odometer });
      byType.set(e.serviceType, list);
    }
    for (const r of reminders) {
      activeReminders += 1;
      const c = computeReminderStatus(
        r,
        r.serviceType ? (byType.get(r.serviceType) ?? []) : [],
        currentMiles,
        now
      );
      if (c.status === "overdue") overdueReminders += 1;
      else if (c.status === "due_soon") dueSoonReminders += 1;
    }
  }

  return {
    ...vehicle,
    openIssueCount,
    warrantySummary: {
      active: activeWarranties,
      expiring: expiringWarranties,
      expired: expiredWarranties,
    },
    reminderSummary: {
      active: activeReminders,
      dueSoon: dueSoonReminders,
      overdue: overdueReminders,
    },
  };
}
