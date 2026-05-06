import { notFound } from "next/navigation";

import { deleteIssue, updateIssue } from "@/app/actions/issues";
import { IssueForm, type ServiceEntryOption } from "@/components/issue-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { serviceLabel } from "@/lib/service-types";

/**
 * Edit an issue. Same form as new, prefilled. Includes a delete action
 * (separate <form>) so the user has to explicitly intend it.
 */
export default async function EditIssuePage({
  params,
}: {
  params: Promise<{ id: string; issueId: string }>;
}) {
  const { id, issueId } = await params;

  const issue = await prisma.issue.findFirst({
    where: { id: issueId, vehicleId: id, vehicle: { isActive: true } },
    include: { vehicle: true },
  });
  if (!issue) notFound();

  // Service entries the user can pick as the "fix" for this issue.
  const entries = await prisma.serviceEntry.findMany({
    where: { vehicleId: id },
    orderBy: { performedAt: "desc" },
    take: 100,
  });
  const serviceEntries: ServiceEntryOption[] = entries.map((s) => ({
    id: s.id,
    label: serviceLabel(s.serviceType, s.customLabel),
    performedAt: s.performedAt,
    odometer: s.odometer,
  }));

  const updateAction = updateIssue.bind(null, id, issueId);
  const deleteAction = deleteIssue.bind(null, id, issueId);

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Edit issue"
        subtitle={`${issue.vehicle.year} ${issue.vehicle.make} ${issue.vehicle.model}`}
        backHref={`/vehicles/${id}/issues`}
      />
      <IssueForm
        action={updateAction}
        defaults={{
          ...issue,
          // Narrow the schema-side string into the form's union so TS
          // stays happy without losing the actual DB value.
          status: issue.status as "open" | "monitoring" | "resolved",
        }}
        serviceEntries={serviceEntries}
        submitLabel="Save changes"
      />

      <form action={deleteAction} className="mt-6">
        <Button variant="danger" size="lg" type="submit">
          Delete issue
        </Button>
      </form>
    </main>
  );
}
