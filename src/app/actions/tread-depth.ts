"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { formDataToObject, treadDepthLogSchema } from "@/lib/validators";

/*
 * Server actions for tread depth logs.
 *
 * Conventions (mirrors tires.ts / tire-pressures.ts / fuel.ts):
 *   - Logs are scoped to a TireSet (not a vehicle), since a replacement
 *     projection only makes sense within a single set's life.
 *   - The action takes both vehicleId AND setId so we can revalidate
 *     the right paths and confirm the set actually belongs to the
 *     requesting vehicle (defense against a hand-crafted form pointing
 *     at another vehicle's set).
 *   - Each tread reading mirrors to OdometerReading (source = "tread_check")
 *     so the canonical mileage timeline includes it. Same shape as
 *     fuel / service / tire_install.
 */

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Confirm the tire set exists, belongs to this vehicle, and the vehicle
 * is still active. Throws on any mismatch — the caller doesn't need to
 * worry about which check failed; from the user's perspective it's all
 * "this set isn't yours".
 */
async function assertSetOwnership(vehicleId: string, setId: string) {
  const set = await prisma.tireSet.findFirst({
    where: { id: setId, vehicleId, vehicle: { isActive: true } },
  });
  if (!set) throw new Error("Tire set not found");
  return set;
}

// -----------------------------------------------------------------------------
// Create
// -----------------------------------------------------------------------------
export async function createTreadDepthLog(
  vehicleId: string,
  setId: string,
  formData: FormData
) {
  await assertSetOwnership(vehicleId, setId);
  const parsed = treadDepthLogSchema.parse(formDataToObject(formData));

  const created = await prisma.treadDepthLog.create({
    data: {
      tireSetId: setId,
      recordedAt: parsed.recordedAt,
      mileage: parsed.mileage,
      fl: parsed.fl,
      fr: parsed.fr,
      rl: parsed.rl,
      rr: parsed.rr,
      notes: parsed.notes ?? null,
    },
  });

  // Mirror to the odometer timeline so the canonical mileage feed
  // includes the tread-check waypoint. sourceId points back at the log
  // row so an update or delete can keep them in sync.
  await prisma.odometerReading.create({
    data: {
      vehicleId,
      miles: parsed.mileage,
      recordedAt: parsed.recordedAt,
      source: "tread_check",
      sourceId: created.id,
    },
  });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/tires`);
  revalidatePath(`/vehicles/${vehicleId}/tires/${setId}/tread`);
  redirect(`/vehicles/${vehicleId}/tires/${setId}/tread`);
}

// -----------------------------------------------------------------------------
// Update
// -----------------------------------------------------------------------------
export async function updateTreadDepthLog(
  vehicleId: string,
  setId: string,
  logId: string,
  formData: FormData
) {
  await assertSetOwnership(vehicleId, setId);
  const parsed = treadDepthLogSchema.parse(formDataToObject(formData));

  // Confirm the log belongs to this set before letting edits through.
  const original = await prisma.treadDepthLog.findUnique({
    where: { id: logId },
  });
  if (!original || original.tireSetId !== setId) {
    throw new Error("Tread log not found");
  }

  await prisma.treadDepthLog.update({
    where: { id: logId },
    data: {
      recordedAt: parsed.recordedAt,
      mileage: parsed.mileage,
      fl: parsed.fl,
      fr: parsed.fr,
      rl: parsed.rl,
      rr: parsed.rr,
      notes: parsed.notes ?? null,
    },
  });

  // Keep the linked odometer reading in sync if mileage or date changed.
  await prisma.odometerReading.updateMany({
    where: { sourceId: logId, source: "tread_check" },
    data: {
      miles: parsed.mileage,
      recordedAt: parsed.recordedAt,
    },
  });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/tires`);
  revalidatePath(`/vehicles/${vehicleId}/tires/${setId}/tread`);
  redirect(`/vehicles/${vehicleId}/tires/${setId}/tread`);
}

// -----------------------------------------------------------------------------
// Delete
// -----------------------------------------------------------------------------
export async function deleteTreadDepthLog(
  vehicleId: string,
  setId: string,
  logId: string
) {
  await assertSetOwnership(vehicleId, setId);

  const original = await prisma.treadDepthLog.findUnique({
    where: { id: logId },
  });
  if (!original || original.tireSetId !== setId) {
    throw new Error("Tread log not found");
  }

  // Drop the mirrored odometer row alongside the log itself, so we
  // don't leave an orphaned waypoint in the timeline.
  await prisma.odometerReading.deleteMany({
    where: { source: "tread_check", sourceId: logId },
  });
  await prisma.treadDepthLog.delete({ where: { id: logId } });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/tires`);
  revalidatePath(`/vehicles/${vehicleId}/tires/${setId}/tread`);
  redirect(`/vehicles/${vehicleId}/tires/${setId}/tread`);
}
