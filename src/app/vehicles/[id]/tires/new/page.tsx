import { notFound } from "next/navigation";

import { createTireSet } from "@/app/actions/tires";
import { PageHeader } from "@/components/page-header";
import { TireSetForm } from "@/components/tire-set-form";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

/**
 * Install a new tire set. Pre-fills install mileage with the latest
 * odometer reading. If there's an active set on the car, surfaces it
 * inline so the user can confirm they want it auto-closed at install.
 */
export default async function NewTireSetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, userId, isActive: true },
    select: {
      id: true,
      year: true,
      make: true,
      model: true,
      odometerReadings: {
        orderBy: { recordedAt: "desc" },
        take: 1,
        select: { miles: true },
      },
    },
  });
  if (!vehicle) notFound();

  const lastMiles = vehicle.odometerReadings[0]?.miles ?? null;

  // Pull the active set (if any) so we can show "Replacing X" UX.
  const active = await prisma.tireSet.findFirst({
    where: { vehicleId: id, removedAt: null },
    orderBy: { installedAt: "desc" },
  });

  const boundAction = createTireSet.bind(null, vehicle.id);
  const activeLabel = active
    ? `${active.brand} ${active.model} (${active.size}) installed at ${active.installMileage.toLocaleString()} mi`
    : null;

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Install tires"
        subtitle={`Last odometer: ${
          lastMiles != null ? `${lastMiles.toLocaleString()} mi` : "—"
        }`}
        backHref={`/vehicles/${vehicle.id}/tires`}
      />
      <TireSetForm
        action={boundAction}
        defaults={{ installMileage: lastMiles }}
        showReplaceToggle={true}
        activeSetLabel={activeLabel}
        submitLabel="Install"
      />
    </main>
  );
}
