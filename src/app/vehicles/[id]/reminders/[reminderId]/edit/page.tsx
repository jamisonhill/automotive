import { notFound } from "next/navigation";

import {
  deleteReminder,
  updateReminder,
} from "@/app/actions/reminders";
import { PageHeader } from "@/components/page-header";
import { ReminderForm } from "@/components/reminder-form";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

/**
 * Edit (or delete) a single reminder.
 */
export default async function EditReminderPage({
  params,
}: {
  params: Promise<{ id: string; reminderId: string }>;
}) {
  const { id, reminderId } = await params;
  const userId = await requireUserId();

  const reminder = await prisma.reminder.findFirst({
    where: {
      id: reminderId,
      vehicleId: id,
      vehicle: { isActive: true, userId },
    },
    include: { vehicle: true },
  });
  if (!reminder) notFound();

  const updateAction = updateReminder.bind(null, id, reminderId);
  const deleteAction = deleteReminder.bind(null, id, reminderId);

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Edit reminder"
        subtitle={`${reminder.vehicle.year} ${reminder.vehicle.make} ${reminder.vehicle.model}`}
        backHref={`/vehicles/${id}/reminders`}
      />

      <ReminderForm
        action={updateAction}
        defaults={reminder}
        submitLabel="Save changes"
      />

      <form action={deleteAction} className="mt-8">
        <Button variant="danger" size="lg" type="submit">
          Delete reminder
        </Button>
      </form>
    </main>
  );
}
