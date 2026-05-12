import { notFound } from "next/navigation";

import {
  deleteTireSet,
  removeTireSet,
  updateTireSet,
} from "@/app/actions/tires";
import { PageHeader } from "@/components/page-header";
import { TireSetForm, TireSetRemovalForm } from "@/components/tire-set-form";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

/**
 * Edit a tire set. Three actions on this page:
 *   - Save changes (TireSetForm)
 *   - Mark as removed (TireSetRemovalForm) — only when set is still active
 *   - Delete (separate <form>) — drops the row entirely. Use with care.
 *
 * Editing the install date/mileage updates the linked OdometerReading
 * via updateTireSet.
 */
export default async function EditTireSetPage({
  params,
}: {
  params: Promise<{ id: string; setId: string }>;
}) {
  const { id, setId } = await params;
  const userId = await requireUserId();

  const set = await prisma.tireSet.findFirst({
    where: { id: setId, vehicleId: id, vehicle: { isActive: true, userId } },
    include: { vehicle: true },
  });
  if (!set) notFound();

  const updateAction = updateTireSet.bind(null, id, setId);
  const removeAction = removeTireSet.bind(null, id, setId);
  const deleteAction = deleteTireSet.bind(null, id, setId);

  const isActive = set.removedAt == null;

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Edit tires"
        subtitle={`${set.vehicle.year} ${set.vehicle.make} ${set.vehicle.model}`}
        backHref={`/vehicles/${id}/tires`}
      />

      {!isActive && set.removedAt && set.removeMileage != null && (
        <div className="mb-4 rounded-md border border-border-subtle bg-bg-elevated p-3">
          <p className="text-xs uppercase tracking-wider text-fg-muted">
            Removed
          </p>
          <p className="text-sm text-fg-primary">
            {set.removedAt.toLocaleDateString()} ·{" "}
            {set.removeMileage.toLocaleString()} mi
            {set.removeReason ? ` · ${set.removeReason}` : ""}
          </p>
        </div>
      )}

      <TireSetForm
        action={updateAction}
        defaults={set}
        showReplaceToggle={false}
        submitLabel="Save changes"
      />

      {isActive && (
        <section className="mt-8 border-t border-border-subtle pt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-secondary">
            Mark as removed
          </h2>
          <p className="mb-3 text-xs text-fg-muted">
            Stamps the date and mileage these came off the car. Pressure
            and tread logs are preserved.
          </p>
          <TireSetRemovalForm
            action={removeAction}
            installMileage={set.installMileage}
          />
        </section>
      )}

      <form action={deleteAction} className="mt-8">
        <Button variant="danger" size="lg" type="submit">
          Delete tire set
        </Button>
      </form>
    </main>
  );
}
