"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireVehicleOwnership } from "@/lib/queries";
import { formDataToObject, pressureLogSchema } from "@/lib/validators";

/*
 * Server actions for tire pressure logs.
 *
 * Conventions (mirrors tires.ts / service.ts / fuel.ts):
 *   - tireSetId is optional in the schema. If the user leaves the picker
 *     blank, we auto-bind to the vehicle's currently-active tire set. If
 *     no active set exists, we save with tireSetId = null. This matches
 *     the natural mental model: "this pressure check is for whatever's on
 *     the car right now."
 *   - Any explicit tireSetId is validated to belong to this vehicle, so
 *     a hand-crafted form can't link to another vehicle's data.
 *   - Pressure logs do NOT mirror to the OdometerReading timeline —
 *     they're not mileage events. (Fuel / service / tire-install do.)
 */

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Returns the currently-installed tire set for a vehicle, or null. Used to
 * default-bind a pressure log when the user didn't explicitly pick one.
 */
async function findActiveTireSet(vehicleId: string) {
  return prisma.tireSet.findFirst({
    where: { vehicleId, removedAt: null },
    orderBy: { installedAt: "desc" },
  });
}

/**
 * Resolve the tireSetId to save for a pressure log:
 *   - If the user picked one explicitly, validate it belongs to this
 *     vehicle and use it.
 *   - If they left it blank, fall back to the active tire set (or null
 *     when there is no active set).
 */
async function resolveTireSetId(
  vehicleId: string,
  picked: string | undefined
): Promise<string | null> {
  if (picked) {
    // Defend against a hand-crafted form pointing at a foreign vehicle.
    const set = await prisma.tireSet.findUnique({ where: { id: picked } });
    if (!set || set.vehicleId !== vehicleId) {
      throw new Error("Tire set not found for this vehicle");
    }
    return picked;
  }
  const active = await findActiveTireSet(vehicleId);
  return active?.id ?? null;
}

// -----------------------------------------------------------------------------
// Create
// -----------------------------------------------------------------------------
export async function createPressureLog(vehicleId: string, formData: FormData) {
  await requireVehicleOwnership(vehicleId);
  const parsed = pressureLogSchema.parse(formDataToObject(formData));

  const tireSetId = await resolveTireSetId(vehicleId, parsed.tireSetId);

  await prisma.tirePressureLog.create({
    data: {
      vehicleId,
      tireSetId,
      recordedAt: parsed.recordedAt,
      ambientF: parsed.ambientF ?? null,
      flBefore: parsed.flBefore ?? null,
      frBefore: parsed.frBefore ?? null,
      rlBefore: parsed.rlBefore ?? null,
      rrBefore: parsed.rrBefore ?? null,
      flAfter: parsed.flAfter ?? null,
      frAfter: parsed.frAfter ?? null,
      rlAfter: parsed.rlAfter ?? null,
      rrAfter: parsed.rrAfter ?? null,
      notes: parsed.notes ?? null,
    },
  });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/tires`);
  revalidatePath(`/vehicles/${vehicleId}/tires/pressures`);
  redirect(`/vehicles/${vehicleId}/tires/pressures`);
}

// -----------------------------------------------------------------------------
// Update
// -----------------------------------------------------------------------------
export async function updatePressureLog(
  vehicleId: string,
  logId: string,
  formData: FormData
) {
  await requireVehicleOwnership(vehicleId);
  const parsed = pressureLogSchema.parse(formDataToObject(formData));

  // Confirm the log belongs to this vehicle before we let edits through.
  const original = await prisma.tirePressureLog.findUnique({
    where: { id: logId },
  });
  if (!original || original.vehicleId !== vehicleId) {
    throw new Error("Pressure log not found");
  }

  const tireSetId = await resolveTireSetId(vehicleId, parsed.tireSetId);

  await prisma.tirePressureLog.update({
    where: { id: logId },
    data: {
      tireSetId,
      recordedAt: parsed.recordedAt,
      ambientF: parsed.ambientF ?? null,
      flBefore: parsed.flBefore ?? null,
      frBefore: parsed.frBefore ?? null,
      rlBefore: parsed.rlBefore ?? null,
      rrBefore: parsed.rrBefore ?? null,
      flAfter: parsed.flAfter ?? null,
      frAfter: parsed.frAfter ?? null,
      rlAfter: parsed.rlAfter ?? null,
      rrAfter: parsed.rrAfter ?? null,
      notes: parsed.notes ?? null,
    },
  });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/tires`);
  revalidatePath(`/vehicles/${vehicleId}/tires/pressures`);
  redirect(`/vehicles/${vehicleId}/tires/pressures`);
}

// -----------------------------------------------------------------------------
// Delete
// -----------------------------------------------------------------------------
export async function deletePressureLog(vehicleId: string, logId: string) {
  await requireVehicleOwnership(vehicleId);
  const original = await prisma.tirePressureLog.findUnique({
    where: { id: logId },
  });
  if (!original || original.vehicleId !== vehicleId) {
    throw new Error("Pressure log not found");
  }

  await prisma.tirePressureLog.delete({ where: { id: logId } });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/tires`);
  revalidatePath(`/vehicles/${vehicleId}/tires/pressures`);
  redirect(`/vehicles/${vehicleId}/tires/pressures`);
}
