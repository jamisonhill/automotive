import { notFound } from "next/navigation";

import {
  deleteTreadDepthLog,
  updateTreadDepthLog,
} from "@/app/actions/tread-depth";
import { PageHeader } from "@/components/page-header";
import { TreadDepthForm } from "@/components/tread-depth-form";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

/**
 * Edit (or delete) a single tread depth reading.
 */
export default async function EditTreadDepthPage({
  params,
}: {
  params: Promise<{ id: string; setId: string; logId: string }>;
}) {
  const { id, setId, logId } = await params;
  const userId = await requireUserId();

  const log = await prisma.treadDepthLog.findFirst({
    where: {
      id: logId,
      tireSetId: setId,
      tireSet: { vehicleId: id, vehicle: { isActive: true, userId } },
    },
    include: {
      tireSet: {
        select: {
          brand: true,
          model: true,
          size: true,
        },
      },
    },
  });
  if (!log) notFound();

  const updateAction = updateTreadDepthLog.bind(null, id, setId, logId);
  const deleteAction = deleteTreadDepthLog.bind(null, id, setId, logId);

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Edit tread depth"
        subtitle={`${log.tireSet.brand} ${log.tireSet.model} · ${log.tireSet.size}`}
        backHref={`/vehicles/${id}/tires/${setId}/tread`}
      />

      <TreadDepthForm
        action={updateAction}
        defaults={log}
        // Edits don't need pre-fill — the persisted mileage is already
        // in defaults — but the prop is required so we pass it anyway.
        lastMileage={log.mileage}
        submitLabel="Save changes"
      />

      <form action={deleteAction} className="mt-8">
        <Button variant="danger" size="lg" type="submit">
          Delete reading
        </Button>
      </form>
    </main>
  );
}
