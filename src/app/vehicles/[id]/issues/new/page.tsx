import { notFound } from "next/navigation";

import { createIssue } from "@/app/actions/issues";
import { IssueForm, type ServiceEntryOption } from "@/components/issue-form";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { serviceLabel } from "@/lib/service-types";

/**
 * Add a new issue. Pre-fills reportedMileage with the vehicle's last
 * known reading as a hint — issues are usually logged shortly after they
 * appear, so the latest mileage is a reasonable starting point.
 */
export default async function NewIssuePage({
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
      // Only repair/diagnostic entries are likely to be a "fix" for an
      // issue — surface those first in the resolution dropdown.
      serviceEntries: {
        orderBy: { performedAt: "desc" },
        take: 50,
      },
    },
  });
  if (!vehicle) notFound();

  const lastMiles = vehicle.odometerReadings[0]?.miles ?? null;
  const boundAction = createIssue.bind(null, vehicle.id);
  const serviceEntries: ServiceEntryOption[] = vehicle.serviceEntries.map(
    (s) => ({
      id: s.id,
      label: serviceLabel(s.serviceType, s.customLabel),
      performedAt: s.performedAt,
      odometer: s.odometer,
    })
  );

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Log issue"
        subtitle={`Last odometer: ${
          lastMiles != null ? `${lastMiles.toLocaleString()} mi` : "—"
        }`}
        backHref={`/vehicles/${vehicle.id}/issues`}
      />
      <IssueForm
        action={boundAction}
        defaults={{ reportedMileage: lastMiles, status: "open" }}
        serviceEntries={serviceEntries}
        submitLabel="Save issue"
      />
    </main>
  );
}
