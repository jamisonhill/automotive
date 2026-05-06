"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import {
  formDataToObject,
  tireSetRemovalSchema,
  tireSetSchema,
} from "@/lib/validators";

/*
 * Server actions for tire sets.
 *
 * Conventions (mirrors fuel.ts / service.ts / issues.ts):
 *   - createTireSet writes an OdometerReading at install time (source =
 *     "tire_install") so the canonical mileage timeline picks it up.
 *   - When the user installs new tires AND chooses "replacing my current
 *     tires" (default), createTireSet auto-closes any active TireSet for
 *     the vehicle, stamping its removedAt + removeMileage to match the
 *     new install. Avoids the common forgotten-bookkeeping case.
 *   - removeTireSet is a *separate* action from delete: removed = the
 *     set is no longer on the car (kept in history). delete = drop the
 *     row entirely (only useful for fixing a mistaken entry).
 */

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Returns the currently-installed tire set for a vehicle, or null. A set
 * counts as installed if it has no removedAt timestamp.
 */
async function findActiveTireSet(vehicleId: string) {
  return prisma.tireSet.findFirst({
    where: { vehicleId, removedAt: null },
    orderBy: { installedAt: "desc" },
  });
}

// -----------------------------------------------------------------------------
// Create
// -----------------------------------------------------------------------------
export async function createTireSet(vehicleId: string, formData: FormData) {
  const parsed = tireSetSchema.parse(formDataToObject(formData));

  // If the user is replacing existing tires, close out the active set
  // first so we never end up with two "current" sets at once.
  if (parsed.closePreviousSet) {
    const active = await findActiveTireSet(vehicleId);
    if (active) {
      await prisma.tireSet.update({
        where: { id: active.id },
        data: {
          removedAt: parsed.installedAt,
          removeMileage: parsed.installMileage,
          // Reason left null — the user is replacing, not categorizing
          // why. They can edit the old set later if they want detail.
        },
      });
    }
  }

  const created = await prisma.tireSet.create({
    data: {
      vehicleId,
      brand: parsed.brand,
      model: parsed.model,
      size: parsed.size,
      loadIndex: parsed.loadIndex ?? null,
      speedRating: parsed.speedRating ?? null,
      treadwear: parsed.treadwear ?? null,
      installedAt: parsed.installedAt,
      installMileage: parsed.installMileage,
      cost: parsed.cost ?? null,
      notes: parsed.notes ?? null,
    },
  });

  // Mirror to the odometer timeline so other views see the install event.
  await prisma.odometerReading.create({
    data: {
      vehicleId,
      miles: parsed.installMileage,
      recordedAt: parsed.installedAt,
      source: "tire_install",
      sourceId: created.id,
    },
  });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/tires`);
  redirect(`/vehicles/${vehicleId}/tires`);
}

// -----------------------------------------------------------------------------
// Update
// -----------------------------------------------------------------------------
export async function updateTireSet(
  vehicleId: string,
  setId: string,
  formData: FormData
) {
  const parsed = tireSetSchema.parse(formDataToObject(formData));

  const original = await prisma.tireSet.findUnique({ where: { id: setId } });
  if (!original || original.vehicleId !== vehicleId) {
    throw new Error("Tire set not found");
  }

  await prisma.tireSet.update({
    where: { id: setId },
    data: {
      brand: parsed.brand,
      model: parsed.model,
      size: parsed.size,
      loadIndex: parsed.loadIndex ?? null,
      speedRating: parsed.speedRating ?? null,
      treadwear: parsed.treadwear ?? null,
      installedAt: parsed.installedAt,
      installMileage: parsed.installMileage,
      cost: parsed.cost ?? null,
      notes: parsed.notes ?? null,
    },
  });

  // Keep the linked install-time odometer reading in sync if the user
  // corrected the install date or mileage on edit.
  await prisma.odometerReading.updateMany({
    where: { sourceId: setId, source: "tire_install" },
    data: {
      miles: parsed.installMileage,
      recordedAt: parsed.installedAt,
    },
  });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/tires`);
  redirect(`/vehicles/${vehicleId}/tires`);
}

// -----------------------------------------------------------------------------
// Mark as removed (separate from delete)
// -----------------------------------------------------------------------------
export async function removeTireSet(
  vehicleId: string,
  setId: string,
  formData: FormData
) {
  const parsed = tireSetRemovalSchema.parse(formDataToObject(formData));

  const original = await prisma.tireSet.findUnique({ where: { id: setId } });
  if (!original || original.vehicleId !== vehicleId) {
    throw new Error("Tire set not found");
  }

  await prisma.tireSet.update({
    where: { id: setId },
    data: {
      removedAt: parsed.removedAt,
      removeMileage: parsed.removeMileage,
      removeReason: parsed.removeReason ?? null,
      // Append removal notes to whatever was already there (don't stomp
      // on the user's install-time notes).
      notes: parsed.removeNotes
        ? original.notes
          ? `${original.notes}\n\n[Removed] ${parsed.removeNotes}`
          : `[Removed] ${parsed.removeNotes}`
        : original.notes,
    },
  });

  // Mirror the removal mileage to the odometer timeline as a separate
  // reading, so the canonical timeline shows "tires came off at X mi".
  await prisma.odometerReading.create({
    data: {
      vehicleId,
      miles: parsed.removeMileage,
      recordedAt: parsed.removedAt,
      source: "tire_remove",
      sourceId: setId,
    },
  });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/tires`);
  redirect(`/vehicles/${vehicleId}/tires`);
}

// -----------------------------------------------------------------------------
// Delete (drop the row entirely — only for fixing mistakes)
// -----------------------------------------------------------------------------
export async function deleteTireSet(vehicleId: string, setId: string) {
  const original = await prisma.tireSet.findUnique({ where: { id: setId } });
  if (!original || original.vehicleId !== vehicleId) {
    throw new Error("Tire set not found");
  }

  // Drop linked odometer readings (install + remove) so we don't leave
  // dangling rows. Pressure / tread logs cascade via the schema.
  await prisma.odometerReading.deleteMany({
    where: {
      vehicleId,
      source: { in: ["tire_install", "tire_remove"] },
      sourceId: setId,
    },
  });
  await prisma.tireSet.delete({ where: { id: setId } });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/tires`);
  redirect(`/vehicles/${vehicleId}/tires`);
}
