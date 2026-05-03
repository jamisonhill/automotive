import { notFound } from "next/navigation";

import { deleteFuelEntry, updateFuelEntry } from "@/app/actions/fuel";
import { FuelForm } from "@/components/fuel-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";

/**
 * Edit a fuel entry. Same form as new, prefilled. Includes a delete action
 * (which uses a separate <form> so the user has to explicitly intend it).
 */
export default async function EditFuelEntryPage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>;
}) {
  const { id, entryId } = await params;

  const entry = await prisma.fuelEntry.findFirst({
    where: { id: entryId, vehicleId: id, vehicle: { isActive: true } },
    include: { vehicle: true },
  });
  if (!entry) notFound();

  const updateAction = updateFuelEntry.bind(null, id, entryId);
  const deleteAction = deleteFuelEntry.bind(null, id, entryId);

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Edit fill-up"
        subtitle={`${entry.vehicle.year} ${entry.vehicle.make} ${entry.vehicle.model}`}
        backHref={`/vehicles/${id}/fuel`}
      />
      <FuelForm
        action={updateAction}
        defaults={entry}
        submitLabel="Save changes"
      />

      <form action={deleteAction} className="mt-6">
        {/* type=submit on a danger button. Browsers don't natively confirm,
            but on iPhone the active:scale + dangerous color makes it clear. */}
        <Button variant="danger" size="lg" type="submit">
          Delete fill-up
        </Button>
      </form>
    </main>
  );
}
