"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { formDataToObject, reminderSchema } from "@/lib/validators";

/*
 * Server actions for reminders.
 *
 * Conventions (mirrors tires.ts / tire-pressures.ts):
 *   - Reminders are scoped per-vehicle. Cross-vehicle defense is the
 *     same shape as elsewhere: confirm the reminder belongs to this
 *     vehicle before edit/delete.
 *   - Reminders do NOT mirror to OdometerReading — they're not
 *     mileage events; they're a forward-looking schedule.
 *   - The "auto-advance from ServiceEntry" link is wired in Phase 6b
 *     by hooking into src/app/actions/service.ts; this file stays
 *     focused on direct CRUD.
 */

// -----------------------------------------------------------------------------
// Create
// -----------------------------------------------------------------------------
export async function createReminder(vehicleId: string, formData: FormData) {
  const parsed = reminderSchema.parse(formDataToObject(formData));

  await prisma.reminder.create({
    data: {
      vehicleId,
      label: parsed.label,
      serviceType: parsed.serviceType ?? null,
      intervalMiles: parsed.intervalMiles ?? null,
      intervalMonths: parsed.intervalMonths ?? null,
      lastDoneMiles: parsed.lastDoneMiles ?? null,
      lastDoneAt: parsed.lastDoneAt ?? null,
      isActive: parsed.isActive,
      notes: parsed.notes ?? null,
    },
  });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/reminders`);
  redirect(`/vehicles/${vehicleId}/reminders`);
}

// -----------------------------------------------------------------------------
// Update
// -----------------------------------------------------------------------------
export async function updateReminder(
  vehicleId: string,
  reminderId: string,
  formData: FormData
) {
  const parsed = reminderSchema.parse(formDataToObject(formData));

  // Confirm ownership before letting edits through.
  const original = await prisma.reminder.findUnique({
    where: { id: reminderId },
  });
  if (!original || original.vehicleId !== vehicleId) {
    throw new Error("Reminder not found");
  }

  await prisma.reminder.update({
    where: { id: reminderId },
    data: {
      label: parsed.label,
      serviceType: parsed.serviceType ?? null,
      intervalMiles: parsed.intervalMiles ?? null,
      intervalMonths: parsed.intervalMonths ?? null,
      lastDoneMiles: parsed.lastDoneMiles ?? null,
      lastDoneAt: parsed.lastDoneAt ?? null,
      isActive: parsed.isActive,
      notes: parsed.notes ?? null,
    },
  });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/reminders`);
  redirect(`/vehicles/${vehicleId}/reminders`);
}

// -----------------------------------------------------------------------------
// Delete
// -----------------------------------------------------------------------------
export async function deleteReminder(vehicleId: string, reminderId: string) {
  const original = await prisma.reminder.findUnique({
    where: { id: reminderId },
  });
  if (!original || original.vehicleId !== vehicleId) {
    throw new Error("Reminder not found");
  }

  await prisma.reminder.delete({ where: { id: reminderId } });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/reminders`);
  redirect(`/vehicles/${vehicleId}/reminders`);
}
