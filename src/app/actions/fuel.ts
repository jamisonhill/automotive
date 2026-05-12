"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { computeTripStats, recomputeFuelMpgFrom } from "@/lib/fuel";
import { pumpOcr, type PumpOcrResult } from "@/lib/ocr";
import { requireVehicleOwnership } from "@/lib/queries";
import { requireUserId } from "@/lib/session";
import {
  fuelSchema,
  formDataToObject,
  odometerSchema,
} from "@/lib/validators";

/*
 * Server actions for fuel entries and manual odometer readings.
 *
 * Conventions:
 *   - All writes also append to OdometerReading so the canonical mileage
 *     timeline stays current with no extra effort.
 *   - After a write that affects MPG (create/update/delete fuel entry),
 *     we recompute downstream entries' tripMpg so historical numbers stay
 *     accurate even when entries are added out of order.
 */

// -----------------------------------------------------------------------------
// Create fuel entry
// -----------------------------------------------------------------------------
export async function createFuelEntry(vehicleId: string, formData: FormData) {
  await requireVehicleOwnership(vehicleId);
  const parsed = fuelSchema.parse(formDataToObject(formData));

  const stats = await computeTripStats({
    vehicleId,
    newOdometer: parsed.odometer,
    newGallons: parsed.gallons,
    newFilledAt: parsed.filledAt,
    partialFill: parsed.partialFill,
    missedFill: parsed.missedFill,
  });

  // If user gave us $/gal but not totalCost (or vice versa), fill in the
  // missing field. The schema makes both optional so we have to derive here
  // rather than at validation time.
  const pricePerGallon =
    parsed.pricePerGallon ??
    (parsed.totalCost && parsed.gallons
      ? parsed.totalCost / parsed.gallons
      : undefined);
  const totalCost =
    parsed.totalCost ??
    (parsed.pricePerGallon && parsed.gallons
      ? parsed.pricePerGallon * parsed.gallons
      : undefined);

  const created = await prisma.fuelEntry.create({
    data: {
      vehicleId,
      filledAt: parsed.filledAt,
      odometer: parsed.odometer,
      gallons: parsed.gallons,
      pricePerGallon: pricePerGallon ?? null,
      totalCost: totalCost ?? null,
      octane: parsed.octane ?? null,
      station: parsed.station ?? null,
      partialFill: parsed.partialFill,
      missedFill: parsed.missedFill,
      notes: parsed.notes ?? null,
      tripMiles: stats.tripMiles,
      tripMpg: stats.tripMpg,
    },
  });

  // Mirror to the odometer timeline.
  await prisma.odometerReading.create({
    data: {
      vehicleId,
      miles: parsed.odometer,
      recordedAt: parsed.filledAt,
      source: "fuel",
      sourceId: created.id,
    },
  });

  // If this entry was inserted before the most recent fill (out-of-order
  // editing), recompute downstream entries.
  await recomputeFuelMpgFrom(vehicleId, parsed.filledAt);

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/fuel`);
  redirect(`/vehicles/${vehicleId}/fuel`);
}

// -----------------------------------------------------------------------------
// Update fuel entry
// -----------------------------------------------------------------------------
export async function updateFuelEntry(
  vehicleId: string,
  entryId: string,
  formData: FormData
) {
  await requireVehicleOwnership(vehicleId);
  const parsed = fuelSchema.parse(formDataToObject(formData));

  const stats = await computeTripStats({
    vehicleId,
    newOdometer: parsed.odometer,
    newGallons: parsed.gallons,
    newFilledAt: parsed.filledAt,
    partialFill: parsed.partialFill,
    missedFill: parsed.missedFill,
    excludeEntryId: entryId,
  });

  const pricePerGallon =
    parsed.pricePerGallon ??
    (parsed.totalCost && parsed.gallons
      ? parsed.totalCost / parsed.gallons
      : undefined);
  const totalCost =
    parsed.totalCost ??
    (parsed.pricePerGallon && parsed.gallons
      ? parsed.pricePerGallon * parsed.gallons
      : undefined);

  // Find the original to know which odometer-reading row to update.
  const original = await prisma.fuelEntry.findUnique({
    where: { id: entryId },
  });
  if (!original || original.vehicleId !== vehicleId) {
    throw new Error("Fuel entry not found");
  }

  await prisma.fuelEntry.update({
    where: { id: entryId },
    data: {
      filledAt: parsed.filledAt,
      odometer: parsed.odometer,
      gallons: parsed.gallons,
      pricePerGallon: pricePerGallon ?? null,
      totalCost: totalCost ?? null,
      octane: parsed.octane ?? null,
      station: parsed.station ?? null,
      partialFill: parsed.partialFill,
      missedFill: parsed.missedFill,
      notes: parsed.notes ?? null,
      tripMiles: stats.tripMiles,
      tripMpg: stats.tripMpg,
    },
  });

  // Update the linked odometer reading too.
  await prisma.odometerReading.updateMany({
    where: { sourceId: entryId, source: "fuel" },
    data: { miles: parsed.odometer, recordedAt: parsed.filledAt },
  });

  // Recompute downstream from whichever is earlier — original or new date.
  const recomputeSince =
    original.filledAt < parsed.filledAt ? original.filledAt : parsed.filledAt;
  await recomputeFuelMpgFrom(vehicleId, recomputeSince);

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/fuel`);
  redirect(`/vehicles/${vehicleId}/fuel`);
}

// -----------------------------------------------------------------------------
// Delete fuel entry
// -----------------------------------------------------------------------------
export async function deleteFuelEntry(vehicleId: string, entryId: string) {
  await requireVehicleOwnership(vehicleId);
  const entry = await prisma.fuelEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.vehicleId !== vehicleId) {
    throw new Error("Fuel entry not found");
  }

  // Delete the linked odometer reading too — keeping it would leave a
  // dangling row pointing nowhere.
  await prisma.odometerReading.deleteMany({
    where: { sourceId: entryId, source: "fuel" },
  });
  await prisma.fuelEntry.delete({ where: { id: entryId } });

  // Recompute downstream entries after the deletion.
  await recomputeFuelMpgFrom(vehicleId, entry.filledAt);

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/fuel`);
  redirect(`/vehicles/${vehicleId}/fuel`);
}

// -----------------------------------------------------------------------------
// OCR a pump-screen photo. Returns the extracted values for the client to
// review before saving the actual fuel entry. Photo is NOT persisted.
// -----------------------------------------------------------------------------
export async function extractPumpData(formData: FormData): Promise<
  | { ok: true; data: PumpOcrResult }
  | { ok: false; error: string }
> {
  // OCR doesn't read or write user-scoped data, but it does consume our
  // Anthropic budget. Require a session so anonymous traffic can't drain it.
  await requireUserId();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No photo uploaded." };
  }

  // Cap incoming bytes — we already resize on the client to ~1280px JPEG,
  // so this is just a defensive ceiling for malformed clients.
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, error: "Photo too large for OCR (8MB max)." };
  }

  const allowed: Array<"image/jpeg" | "image/png" | "image/webp"> = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];
  const mediaType = allowed.find((m) => m === file.type);
  if (!mediaType) {
    return {
      ok: false,
      error: `Unsupported image type: ${file.type}. Use JPEG, PNG, or WebP.`,
    };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const result = await pumpOcr(base64, mediaType);
    return { ok: true, data: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "OCR failed.";
    return { ok: false, error: message };
  }
}

// -----------------------------------------------------------------------------
// Manual odometer reading (between fills/services)
// -----------------------------------------------------------------------------
export async function logOdometer(vehicleId: string, formData: FormData) {
  await requireVehicleOwnership(vehicleId);
  const parsed = odometerSchema.parse(formDataToObject(formData));

  await prisma.odometerReading.create({
    data: {
      vehicleId,
      miles: parsed.miles,
      recordedAt: parsed.recordedAt,
      source: "manual",
    },
  });

  revalidatePath(`/vehicles/${vehicleId}`);
}
