import { notFound } from "next/navigation";

import { createServiceEntry } from "@/app/actions/service";
import { PageHeader } from "@/components/page-header";
import { ServiceForm } from "@/components/service-form";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

/**
 * Add a new service entry. Pre-fills odometer with the vehicle's last
 * known reading as a hint — most service is logged shortly after it
 * happens, so the user usually only needs to bump it a little.
 */
export default async function NewServiceEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, userId, isActive: true },
    include: {
      odometerReadings: { orderBy: { recordedAt: "desc" }, take: 1 },
    },
  });
  if (!vehicle) notFound();

  const lastMiles = vehicle.odometerReadings[0]?.miles ?? null;
  const boundAction = createServiceEntry.bind(null, vehicle.id);

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Add service"
        subtitle={`Last odometer: ${
          lastMiles != null ? `${lastMiles.toLocaleString()} mi` : "—"
        }`}
        backHref={`/vehicles/${vehicle.id}/service`}
      />
      <ServiceForm
        action={boundAction}
        // Default the date to today. We compute it here in the server
        // component (a single render) instead of inside the client form,
        // so SSR HTML and client hydration see the exact same string.
        defaults={{ odometer: lastMiles, performedAt: new Date() }}
        submitLabel="Save service"
      />
    </main>
  );
}
