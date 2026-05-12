import { notFound } from "next/navigation";

import {
  deletePressureLog,
  updatePressureLog,
} from "@/app/actions/tire-pressures";
import { PageHeader } from "@/components/page-header";
import {
  PressureLogForm,
  type TireSetOption,
} from "@/components/pressure-log-form";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

/**
 * Edit (or delete) a single pressure log entry.
 *
 * The tire-set picker shows currently-active sets PLUS the set this log
 * was originally linked to (even if since removed) — so the user can see
 * the historical relationship without it silently disappearing.
 */
export default async function EditPressureLogPage({
  params,
}: {
  params: Promise<{ id: string; logId: string }>;
}) {
  const { id, logId } = await params;
  const userId = await requireUserId();

  const log = await prisma.tirePressureLog.findFirst({
    where: { id: logId, vehicleId: id, vehicle: { isActive: true, userId } },
    include: { vehicle: true },
  });
  if (!log) notFound();

  // Active sets for the picker. Newest install first, mirroring /new.
  const activeSets = await prisma.tireSet.findMany({
    where: { vehicleId: id, removedAt: null },
    orderBy: { installedAt: "desc" },
    select: { id: true, brand: true, model: true, size: true },
  });
  const activeId = activeSets[0]?.id ?? null;

  // If the log links a set that's no longer active, append it so the user
  // sees what's persisted (and can choose to keep or change it).
  let allOptions = activeSets;
  if (log.tireSetId && !activeSets.some((s) => s.id === log.tireSetId)) {
    const linked = await prisma.tireSet.findUnique({
      where: { id: log.tireSetId },
      select: { id: true, brand: true, model: true, size: true },
    });
    if (linked) allOptions = [...activeSets, linked];
  }

  const tireSetOptions: TireSetOption[] = allOptions.map((s) => ({
    id: s.id,
    label: `${s.brand} ${s.model} · ${s.size}`,
    isActive: s.id === activeId,
  }));

  const updateAction = updatePressureLog.bind(null, id, logId);
  const deleteAction = deletePressureLog.bind(null, id, logId);

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Edit pressures"
        subtitle={`${log.vehicle.year} ${log.vehicle.make} ${log.vehicle.model}`}
        backHref={`/vehicles/${id}/tires/pressures`}
      />

      <PressureLogForm
        action={updateAction}
        defaults={log}
        tireSetOptions={tireSetOptions}
        submitLabel="Save changes"
      />

      <form action={deleteAction} className="mt-8">
        <Button variant="danger" size="lg" type="submit">
          Delete entry
        </Button>
      </form>
    </main>
  );
}
