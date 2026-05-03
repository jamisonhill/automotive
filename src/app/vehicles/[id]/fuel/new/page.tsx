import { notFound } from "next/navigation";

import { createFuelEntry } from "@/app/actions/fuel";
import { FuelForm } from "@/components/fuel-form";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";

/**
 * Add a new fill-up. Pre-fills odometer with the vehicle's last known
 * reading as a hint (user usually only adds 5–500 miles since then).
 */
export default async function NewFuelEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, isActive: true },
    include: {
      odometerReadings: { orderBy: { recordedAt: "desc" }, take: 1 },
    },
  });
  if (!vehicle) notFound();

  const lastMiles = vehicle.odometerReadings[0]?.miles ?? null;
  const boundAction = createFuelEntry.bind(null, vehicle.id);

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Add fill-up"
        subtitle={`Last odometer: ${
          lastMiles != null ? `${lastMiles.toLocaleString()} mi` : "—"
        }`}
        backHref={`/vehicles/${vehicle.id}/fuel`}
      />
      <FuelForm
        action={boundAction}
        defaults={{ odometer: lastMiles }}
        submitLabel="Save fill-up"
      />
    </main>
  );
}
