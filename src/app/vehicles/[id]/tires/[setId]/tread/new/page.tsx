import { notFound } from "next/navigation";

import { createTreadDepthLog } from "@/app/actions/tread-depth";
import { PageHeader } from "@/components/page-header";
import { TreadDepthForm } from "@/components/tread-depth-form";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

/**
 * Log a new tread depth reading. Mileage pre-fills with the latest
 * odometer reading on the vehicle so the user doesn't usually have
 * to retype it.
 */
export default async function NewTreadDepthPage({
  params,
}: {
  params: Promise<{ id: string; setId: string }>;
}) {
  const { id, setId } = await params;
  const userId = await requireUserId();

  const set = await prisma.tireSet.findFirst({
    where: { id: setId, vehicleId: id, vehicle: { isActive: true, userId } },
    include: {
      vehicle: {
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
      },
    },
  });
  if (!set) notFound();

  const lastMileage = set.vehicle.odometerReadings[0]?.miles ?? null;

  const boundAction = createTreadDepthLog.bind(null, id, setId);

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Log tread depth"
        subtitle={`${set.brand} ${set.model} · ${set.size}`}
        backHref={`/vehicles/${id}/tires/${setId}/tread`}
      />
      <TreadDepthForm
        action={boundAction}
        lastMileage={lastMileage}
        submitLabel="Save"
      />
    </main>
  );
}
