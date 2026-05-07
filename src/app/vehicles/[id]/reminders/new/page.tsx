import { notFound } from "next/navigation";

import { createReminder } from "@/app/actions/reminders";
import { PageHeader } from "@/components/page-header";
import { ReminderForm } from "@/components/reminder-form";
import { prisma } from "@/lib/db";

/**
 * Create a new reminder for this vehicle.
 */
export default async function NewReminderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, isActive: true },
    select: { id: true, year: true, make: true, model: true, nickname: true },
  });
  if (!vehicle) notFound();

  const boundAction = createReminder.bind(null, vehicle.id);

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Add reminder"
        subtitle={
          vehicle.nickname ?? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        }
        backHref={`/vehicles/${vehicle.id}/reminders`}
      />
      <ReminderForm action={boundAction} submitLabel="Save" />
    </main>
  );
}
