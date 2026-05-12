"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { savePhotoUpload } from "@/lib/photos";
import { requireVehicleOwnership } from "@/lib/queries";
import { requireUserId } from "@/lib/session";
import {
  baselineSchema,
  formDataToObject,
  vehicleSchema,
} from "@/lib/validators";

/*
 * Server actions for vehicle CRUD + baseline.
 *
 * Server actions are functions invoked from a <form action={...}> on the
 * client; Next.js handles the round-trip. They run only on the server, so
 * we can use the Prisma client and filesystem freely.
 *
 * Each action:
 *   1. Parses FormData with the matching zod schema (validation)
 *   2. Performs the DB write
 *   3. revalidatePath() invalidates cached pages so the UI refreshes
 *   4. redirect() navigates to the next page on success
 *
 * Errors are thrown — Next will turn unhandled errors into a 500. Once we
 * add proper inline error display we'll switch to returning a result shape.
 */

// -----------------------------------------------------------------------------
// Create vehicle (with optional photo upload)
// -----------------------------------------------------------------------------
export async function createVehicle(formData: FormData) {
  const userId = await requireUserId();
  const parsed = vehicleSchema.parse(formDataToObject(formData));

  // Photo is a File entry — handle separately from the zod-validated payload.
  const photoFile = formData.get("photo");
  let photoPath: string | null = null;
  if (photoFile instanceof File && photoFile.size > 0) {
    photoPath = await savePhotoUpload(photoFile);
  }

  // If the user gave a purchase mileage, also seed the OdometerReading log
  // so the timeline starts from day one.
  const created = await prisma.vehicle.create({
    data: {
      ...parsed,
      userId,
      photoPath,
      odometerReadings:
        parsed.purchaseMileage != null
          ? {
              create: {
                miles: parsed.purchaseMileage,
                recordedAt: parsed.purchaseDate ?? new Date(),
                source: "manual",
              },
            }
          : undefined,
    },
  });

  revalidatePath("/");
  redirect(`/vehicles/${created.id}`);
}

// -----------------------------------------------------------------------------
// Update vehicle
// -----------------------------------------------------------------------------
export async function updateVehicle(id: string, formData: FormData) {
  // Reject the write before touching the form payload if the caller doesn't
  // own this vehicle. Throws 404 — never leaks cross-user existence.
  await requireVehicleOwnership(id);

  const parsed = vehicleSchema.parse(formDataToObject(formData));

  // Photo update is opt-in: only replace if a new file was sent.
  const photoFile = formData.get("photo");
  let photoPath: string | undefined;
  if (photoFile instanceof File && photoFile.size > 0) {
    photoPath = await savePhotoUpload(photoFile);
  }

  await prisma.vehicle.update({
    where: { id },
    data: {
      ...parsed,
      ...(photoPath ? { photoPath } : {}),
    },
  });

  revalidatePath("/");
  revalidatePath(`/vehicles/${id}`);
  redirect(`/vehicles/${id}`);
}

// -----------------------------------------------------------------------------
// Archive vehicle (soft-delete: keep history, hide from main list)
// -----------------------------------------------------------------------------
export async function archiveVehicle(id: string) {
  await requireVehicleOwnership(id);
  await prisma.vehicle.update({
    where: { id },
    data: { isActive: false },
  });
  revalidatePath("/");
  redirect("/");
}

// -----------------------------------------------------------------------------
// Save baseline (upsert — there's at most one per vehicle)
// -----------------------------------------------------------------------------
export async function saveBaseline(vehicleId: string, formData: FormData) {
  await requireVehicleOwnership(vehicleId);
  const parsed = baselineSchema.parse(formDataToObject(formData));

  await prisma.baseline.upsert({
    where: { vehicleId },
    create: { vehicleId, ...parsed },
    update: parsed,
  });

  // Also write an OdometerReading at the baseline mileage. This anchors the
  // mileage timeline so charts have a starting point even before any fuel
  // entry.
  await prisma.odometerReading.create({
    data: {
      vehicleId,
      miles: parsed.mileageAtBaseline,
      recordedAt: new Date(),
      source: "baseline",
    },
  });

  revalidatePath(`/vehicles/${vehicleId}`);
  redirect(`/vehicles/${vehicleId}`);
}
