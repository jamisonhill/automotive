import { prisma } from "@/lib/db";
import { computeWarrantyStatus } from "@/lib/warranties";

/*
 * Read helpers used by server components.
 *
 * Keeping query logic out of pages keeps components focused on rendering and
 * makes it easier to share queries between routes (e.g., the garage list and
 * a future global search both want "active vehicles").
 */

/**
 * Active vehicles for the garage list, with the most recent odometer reading
 * pre-loaded so the card can show current mileage without a follow-up query.
 */
export async function listActiveVehicles() {
  return prisma.vehicle.findMany({
    where: { isActive: true },
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
 * Single vehicle by id, with the most recent odometer reading, baseline,
 * most recent fuel entry, most recent service entry, and the count of
 * open + monitoring issues so the dashboard can surface a badge. Returns
 * null if the vehicle doesn't exist or has been archived.
 */
export async function getVehicle(id: string) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, isActive: true },
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

  return {
    ...vehicle,
    openIssueCount,
    warrantySummary: {
      active: activeWarranties,
      expiring: expiringWarranties,
      expired: expiredWarranties,
    },
  };
}
