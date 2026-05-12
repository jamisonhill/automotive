"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireVehicleOwnership } from "@/lib/queries";
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
  await requireVehicleOwnership(vehicleId);
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
  await requireVehicleOwnership(vehicleId);
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
// Seed common reminders
// -----------------------------------------------------------------------------

/*
 * The canonical "starter set" of maintenance reminders for a typical
 * passenger vehicle. Intervals are conservative defaults — the user can
 * tighten or loosen any of them after seeding by editing the row.
 *
 * serviceType strings MUST match the catalog in src/lib/service-types.ts
 * so that auto-advance from ServiceEntry rows works out of the box.
 */
const COMMON_REMINDER_DEFAULTS: {
  label: string;
  serviceType: string;
  intervalMiles: number | null;
  intervalMonths: number | null;
}[] = [
  {
    label: "Oil change",
    serviceType: "oil_change",
    intervalMiles: 5000,
    intervalMonths: 6,
  },
  {
    label: "Tire rotation",
    serviceType: "tire_rotation",
    intervalMiles: 5000,
    intervalMonths: null,
  },
  {
    label: "Engine air filter",
    serviceType: "air_filter",
    intervalMiles: 15000,
    intervalMonths: 24,
  },
  {
    label: "Cabin air filter",
    serviceType: "cabin_filter",
    intervalMiles: 15000,
    intervalMonths: 24,
  },
  {
    label: "Brake fluid flush",
    serviceType: "brake_fluid_flush",
    intervalMiles: null,
    intervalMonths: 24,
  },
  {
    label: "State inspection",
    serviceType: "state_inspection",
    intervalMiles: null,
    intervalMonths: 12,
  },
  {
    label: "Wiper blades",
    serviceType: "wiper_blades",
    intervalMiles: null,
    intervalMonths: 12,
  },
];

/**
 * Bulk-create the starter set, skipping any serviceType already present
 * on the vehicle so repeat clicks are safe (idempotent in practice). The
 * vehicle stays on the reminders page after the create — no redirect.
 */
export async function seedCommonReminders(vehicleId: string) {
  await requireVehicleOwnership(vehicleId);
  const candidateTypes = COMMON_REMINDER_DEFAULTS.map((d) => d.serviceType);
  const existing = await prisma.reminder.findMany({
    where: { vehicleId, serviceType: { in: candidateTypes } },
    select: { serviceType: true },
  });
  const existingSet = new Set(existing.map((r) => r.serviceType));

  const toCreate = COMMON_REMINDER_DEFAULTS.filter(
    (d) => !existingSet.has(d.serviceType)
  );

  if (toCreate.length > 0) {
    await prisma.reminder.createMany({
      data: toCreate.map((d) => ({
        vehicleId,
        label: d.label,
        serviceType: d.serviceType,
        intervalMiles: d.intervalMiles,
        intervalMonths: d.intervalMonths,
      })),
    });
  }

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/reminders`);
}

// -----------------------------------------------------------------------------
// Delete
// -----------------------------------------------------------------------------
export async function deleteReminder(vehicleId: string, reminderId: string) {
  await requireVehicleOwnership(vehicleId);
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
