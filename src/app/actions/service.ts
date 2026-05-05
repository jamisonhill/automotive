"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { receiptDir } from "@/lib/config";
import { prisma } from "@/lib/db";
import { saveReceiptUpload } from "@/lib/receipts";
import { formDataToObject, serviceSchema } from "@/lib/validators";

/*
 * Server actions for service entries (routine maintenance, repairs,
 * inspections, modifications, diagnostics).
 *
 * Conventions (mirrors fuel.ts):
 *   - Every write also appends to OdometerReading so the canonical
 *     mileage timeline stays current.
 *   - Receipts are uploaded as a "receipt" form file. We persist only the
 *     filename in receiptPath; the file lives under DATA_DIR/receipts.
 *   - For "custom" service types the user supplies customLabel; for
 *     catalog types we ignore whatever they typed in customLabel.
 */

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Pull the receipt file (if any) out of the FormData. Empty file objects
 * (size 0) come from leaving the upload field blank — treat as no file.
 */
function extractReceiptFile(formData: FormData): File | null {
  const f = formData.get("receipt");
  if (!(f instanceof File) || f.size === 0) return null;
  return f;
}

/**
 * Best-effort delete of a previously uploaded receipt. Logs and swallows
 * errors so a missing file doesn't block the user from updating an entry.
 */
async function deleteReceiptFile(filename: string | null) {
  if (!filename) return;
  try {
    await unlink(path.join(receiptDir(), filename));
  } catch (err) {
    // ENOENT is fine — the file might already have been deleted manually.
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Failed to delete receipt file:", err);
    }
  }
}

// -----------------------------------------------------------------------------
// Create
// -----------------------------------------------------------------------------
export async function createServiceEntry(
  vehicleId: string,
  formData: FormData
) {
  const parsed = serviceSchema.parse(formDataToObject(formData));

  // Receipt upload is optional. If a file came through, write it before
  // the DB row so receiptPath is populated on the row from the start.
  const receipt = extractReceiptFile(formData);
  const receiptPath = receipt ? await saveReceiptUpload(receipt) : null;

  const created = await prisma.serviceEntry.create({
    data: {
      vehicleId,
      category: parsed.category,
      serviceType: parsed.serviceType,
      customLabel:
        parsed.serviceType === "custom" ? parsed.customLabel ?? null : null,
      performedAt: parsed.performedAt,
      odometer: parsed.odometer,

      partBrand: parsed.partBrand ?? null,
      partNumber: parsed.partNumber ?? null,
      partCondition: parsed.partCondition ?? null,
      supplier: parsed.supplier ?? null,

      warrantyMonths: parsed.warrantyMonths ?? null,
      warrantyMiles: parsed.warrantyMiles ?? null,

      partsCost: parsed.partsCost ?? null,
      laborCost: parsed.laborCost ?? null,
      totalCost: parsed.totalCost ?? null,

      diy: parsed.diy,
      shopName: parsed.shopName ?? null,

      symptoms: parsed.symptoms ?? null,
      diagnosis: parsed.diagnosis ?? null,

      oilType: parsed.oilType ?? null,
      oilViscosity: parsed.oilViscosity ?? null,
      oilFilterPart: parsed.oilFilterPart ?? null,

      resolvedIssueId: parsed.resolvedIssueId ?? null,
      notes: parsed.notes ?? null,
      receiptPath,
    },
  });

  // Mirror to the odometer timeline so other views see the latest mileage.
  await prisma.odometerReading.create({
    data: {
      vehicleId,
      miles: parsed.odometer,
      recordedAt: parsed.performedAt,
      source: "service",
      sourceId: created.id,
    },
  });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/service`);
  redirect(`/vehicles/${vehicleId}/service`);
}

// -----------------------------------------------------------------------------
// Update
// -----------------------------------------------------------------------------
export async function updateServiceEntry(
  vehicleId: string,
  entryId: string,
  formData: FormData
) {
  const parsed = serviceSchema.parse(formDataToObject(formData));

  const original = await prisma.serviceEntry.findUnique({
    where: { id: entryId },
  });
  if (!original || original.vehicleId !== vehicleId) {
    throw new Error("Service entry not found");
  }

  // Handle receipt: a new file replaces the old one; "remove" checkbox clears
  // it; otherwise leave the existing receiptPath untouched.
  const newReceipt = extractReceiptFile(formData);
  const removeReceipt = formData.get("removeReceipt") === "on";
  let receiptPath: string | null = original.receiptPath;
  if (newReceipt) {
    receiptPath = await saveReceiptUpload(newReceipt);
    await deleteReceiptFile(original.receiptPath);
  } else if (removeReceipt) {
    await deleteReceiptFile(original.receiptPath);
    receiptPath = null;
  }

  await prisma.serviceEntry.update({
    where: { id: entryId },
    data: {
      category: parsed.category,
      serviceType: parsed.serviceType,
      customLabel:
        parsed.serviceType === "custom" ? parsed.customLabel ?? null : null,
      performedAt: parsed.performedAt,
      odometer: parsed.odometer,

      partBrand: parsed.partBrand ?? null,
      partNumber: parsed.partNumber ?? null,
      partCondition: parsed.partCondition ?? null,
      supplier: parsed.supplier ?? null,

      warrantyMonths: parsed.warrantyMonths ?? null,
      warrantyMiles: parsed.warrantyMiles ?? null,

      partsCost: parsed.partsCost ?? null,
      laborCost: parsed.laborCost ?? null,
      totalCost: parsed.totalCost ?? null,

      diy: parsed.diy,
      shopName: parsed.shopName ?? null,

      symptoms: parsed.symptoms ?? null,
      diagnosis: parsed.diagnosis ?? null,

      oilType: parsed.oilType ?? null,
      oilViscosity: parsed.oilViscosity ?? null,
      oilFilterPart: parsed.oilFilterPart ?? null,

      resolvedIssueId: parsed.resolvedIssueId ?? null,
      notes: parsed.notes ?? null,
      receiptPath,
    },
  });

  // Update the linked odometer reading to match the new performedAt/odometer.
  await prisma.odometerReading.updateMany({
    where: { sourceId: entryId, source: "service" },
    data: { miles: parsed.odometer, recordedAt: parsed.performedAt },
  });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/service`);
  redirect(`/vehicles/${vehicleId}/service`);
}

// -----------------------------------------------------------------------------
// Delete
// -----------------------------------------------------------------------------
export async function deleteServiceEntry(vehicleId: string, entryId: string) {
  const entry = await prisma.serviceEntry.findUnique({
    where: { id: entryId },
  });
  if (!entry || entry.vehicleId !== vehicleId) {
    throw new Error("Service entry not found");
  }

  // Drop the linked odometer reading so we don't leave dangling rows.
  await prisma.odometerReading.deleteMany({
    where: { sourceId: entryId, source: "service" },
  });
  await prisma.serviceEntry.delete({ where: { id: entryId } });

  // Best-effort: remove the receipt file from disk.
  await deleteReceiptFile(entry.receiptPath);

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/service`);
  redirect(`/vehicles/${vehicleId}/service`);
}
