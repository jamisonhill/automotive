import { notFound } from "next/navigation";

import { createPressureLog } from "@/app/actions/tire-pressures";
import { PageHeader } from "@/components/page-header";
import {
  PressureLogForm,
  type TireSetOption,
} from "@/components/pressure-log-form";
import { prisma } from "@/lib/db";

/**
 * Log a new pressure check. The form's tire-set picker is pre-selected
 * to the active set when one exists; the action will also default-bind
 * if the user leaves the picker blank.
 */
export default async function NewPressureLogPage({
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

  // Currently-installed sets for the picker. Newest install first so the
  // (typically only) active set sorts naturally to the top.
  const activeSets = await prisma.tireSet.findMany({
    where: { vehicleId: id, removedAt: null },
    orderBy: { installedAt: "desc" },
    select: { id: true, brand: true, model: true, size: true },
  });

  // The "current" set (newest active) gets the isActive flag — the form
  // uses it to preselect the picker when there are no defaults.
  const activeId = activeSets[0]?.id ?? null;

  const tireSetOptions: TireSetOption[] = activeSets.map((s) => ({
    id: s.id,
    label: `${s.brand} ${s.model} · ${s.size}`,
    isActive: s.id === activeId,
  }));

  const boundAction = createPressureLog.bind(null, vehicle.id);

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Log pressures"
        subtitle={
          vehicle.nickname ?? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        }
        backHref={`/vehicles/${vehicle.id}/tires/pressures`}
      />
      <PressureLogForm
        action={boundAction}
        tireSetOptions={tireSetOptions}
        submitLabel="Save"
      />
    </main>
  );
}
