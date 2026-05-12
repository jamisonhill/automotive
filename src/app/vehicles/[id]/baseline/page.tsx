import { notFound } from "next/navigation";

import { saveBaseline } from "@/app/actions/vehicles";
import { BaselineForm } from "@/components/baseline-form";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

/*
 * Used-car baseline intake.
 *
 * Renders the long form. If a baseline already exists, prefills it so the
 * page doubles as an edit view (saveBaseline is an upsert).
 */
export default async function BaselinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, userId, isActive: true },
    include: { baseline: true },
  });
  if (!vehicle) notFound();

  // bind() prepends the vehicle id to the server-action call.
  const boundAction = saveBaseline.bind(null, vehicle.id);

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Baseline condition"
        subtitle={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
        backHref={`/vehicles/${vehicle.id}`}
      />
      <BaselineForm
        action={boundAction}
        defaults={vehicle.baseline ?? undefined}
        vehicleSuggestedMileage={vehicle.purchaseMileage}
        submitLabel={vehicle.baseline ? "Update baseline" : "Save baseline"}
      />
    </main>
  );
}
