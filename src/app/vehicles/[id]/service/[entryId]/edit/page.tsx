import { notFound } from "next/navigation";

import {
  deleteServiceEntry,
  updateServiceEntry,
} from "@/app/actions/service";
import { PageHeader } from "@/components/page-header";
import { ServiceForm } from "@/components/service-form";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import type { ServiceCategory } from "@/lib/service-types";

/**
 * Edit a service entry. Same form as new, prefilled. Includes a delete
 * action (separate <form>) so the user has to explicitly intend it.
 */
export default async function EditServiceEntryPage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>;
}) {
  const { id, entryId } = await params;
  const userId = await requireUserId();

  const entry = await prisma.serviceEntry.findFirst({
    where: { id: entryId, vehicleId: id, vehicle: { isActive: true, userId } },
    include: { vehicle: true },
  });
  if (!entry) notFound();

  const updateAction = updateServiceEntry.bind(null, id, entryId);
  const deleteAction = deleteServiceEntry.bind(null, id, entryId);

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Edit service"
        subtitle={`${entry.vehicle.year} ${entry.vehicle.make} ${entry.vehicle.model}`}
        backHref={`/vehicles/${id}/service`}
      />
      <ServiceForm
        action={updateAction}
        defaults={{
          ...entry,
          // Narrow the schema-side strings into the form's discriminated unions
          // so TypeScript stays happy without losing the original DB values.
          category: entry.category as ServiceCategory,
          partCondition: entry.partCondition as
            | "new"
            | "reman"
            | "used"
            | null,
          oilType: entry.oilType as
            | "conventional"
            | "synthetic"
            | "high-mileage"
            | "blend"
            | null,
        }}
        submitLabel="Save changes"
      />

      <form action={deleteAction} className="mt-6">
        <Button variant="danger" size="lg" type="submit">
          Delete service entry
        </Button>
      </form>
    </main>
  );
}
