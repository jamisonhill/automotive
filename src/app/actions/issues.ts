"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireVehicleOwnership } from "@/lib/queries";
import { formDataToObject, issueSchema } from "@/lib/validators";

/*
 * Server actions for Issue / DTC log entries.
 *
 * Conventions (mirrors fuel.ts and service.ts):
 *   - Issues do NOT mirror to OdometerReading. The mileage on an issue is
 *     "when did I notice this", not a canonical odometer event — using it
 *     to drive the timeline would create false positives (the issue might
 *     pre-date when it was logged by months).
 *   - DTC codes come in as raw user text; we normalize to a comma-separated
 *     uppercase string like "P0301,P0302" for stable storage.
 *   - On status='resolved', we auto-default resolvedAt to now if blank, so
 *     the user doesn't have to set it explicitly.
 *   - When an issue is linked to a service entry as the resolution, we set
 *     the link in BOTH directions (Issue.resolvedServiceEntryId and
 *     ServiceEntry.resolvedIssueId) — close the loop.
 */

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Normalize raw DTC text (the user might type "p0301, p0302" or "P0301
 * P0302" or paste a list) into a canonical comma-separated uppercase
 * form. Returns null if the result is empty.
 */
function normalizeDtcCodes(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const codes = raw
    .split(/[,\s]+/) // split on comma or whitespace
    .map((c) => c.trim().toUpperCase())
    .filter((c) => c.length > 0);
  if (codes.length === 0) return null;
  return codes.join(",");
}

/**
 * If the user marked an issue resolved without filling in resolvedAt,
 * stamp it with "now". Conversely, if status is not resolved, force
 * resolvedAt back to null so we don't leave stale resolution dates.
 */
function reconcileResolvedAt(
  status: "open" | "monitoring" | "resolved",
  resolvedAt: Date | undefined
): Date | null {
  if (status === "resolved") {
    return resolvedAt ?? new Date();
  }
  return null;
}

/**
 * If we're linking an issue to a service entry as the resolution, also
 * set the reverse link on the service entry so the service log shows
 * "fixed [issue]". And if a previously-linked entry is being unlinked,
 * clear its reverse link too.
 */
async function syncServiceEntryLink(
  issueId: string,
  vehicleId: string,
  oldServiceEntryId: string | null,
  newServiceEntryId: string | null
) {
  // Clear the reverse link on the previously-linked entry if it changed.
  if (oldServiceEntryId && oldServiceEntryId !== newServiceEntryId) {
    await prisma.serviceEntry
      .updateMany({
        where: {
          id: oldServiceEntryId,
          vehicleId,
          resolvedIssueId: issueId, // only clear if it points to THIS issue
        },
        data: { resolvedIssueId: null },
      })
      .catch(() => {
        // Best-effort — if the service entry was deleted out from under
        // us, that's fine.
      });
  }
  // Set the reverse link on the newly-linked entry.
  if (newServiceEntryId && newServiceEntryId !== oldServiceEntryId) {
    await prisma.serviceEntry.updateMany({
      where: { id: newServiceEntryId, vehicleId },
      data: { resolvedIssueId: issueId },
    });
  }
}

// -----------------------------------------------------------------------------
// Create
// -----------------------------------------------------------------------------
export async function createIssue(vehicleId: string, formData: FormData) {
  await requireVehicleOwnership(vehicleId);
  const parsed = issueSchema.parse(formDataToObject(formData));

  // If the user didn't type a mileage, fall back to the most recent
  // odometer reading on file — issues are often logged after the fact, and
  // the latest known mileage is a reasonable approximation.
  let reportedMileage = parsed.reportedMileage ?? null;
  if (reportedMileage == null) {
    const latest = await prisma.odometerReading.findFirst({
      where: { vehicleId },
      orderBy: { recordedAt: "desc" },
      select: { miles: true },
    });
    reportedMileage = latest?.miles ?? null;
  }

  const resolvedAt = reconcileResolvedAt(parsed.status, parsed.resolvedAt);
  const resolvedServiceEntryId =
    parsed.status === "resolved" ? parsed.resolvedServiceEntryId ?? null : null;

  const created = await prisma.issue.create({
    data: {
      vehicleId,
      symptom: parsed.symptom,
      status: parsed.status,
      reportedAt: parsed.reportedAt,
      reportedMileage,
      diagnosis: parsed.diagnosis ?? null,
      dtcCodes: normalizeDtcCodes(parsed.dtcCodes),
      resolvedAt,
      resolvedServiceEntryId,
      notes: parsed.notes ?? null,
    },
  });

  // Bidirectional link: if the user picked a service entry as the fix,
  // also stamp that service entry's resolvedIssueId.
  await syncServiceEntryLink(
    created.id,
    vehicleId,
    null,
    resolvedServiceEntryId
  );

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/issues`);
  redirect(`/vehicles/${vehicleId}/issues`);
}

// -----------------------------------------------------------------------------
// Update
// -----------------------------------------------------------------------------
export async function updateIssue(
  vehicleId: string,
  issueId: string,
  formData: FormData
) {
  await requireVehicleOwnership(vehicleId);
  const parsed = issueSchema.parse(formDataToObject(formData));

  const original = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { vehicleId: true, resolvedServiceEntryId: true },
  });
  if (!original || original.vehicleId !== vehicleId) {
    throw new Error("Issue not found");
  }

  const resolvedAt = reconcileResolvedAt(parsed.status, parsed.resolvedAt);
  const resolvedServiceEntryId =
    parsed.status === "resolved" ? parsed.resolvedServiceEntryId ?? null : null;

  await prisma.issue.update({
    where: { id: issueId },
    data: {
      symptom: parsed.symptom,
      status: parsed.status,
      reportedAt: parsed.reportedAt,
      reportedMileage: parsed.reportedMileage ?? null,
      diagnosis: parsed.diagnosis ?? null,
      dtcCodes: normalizeDtcCodes(parsed.dtcCodes),
      resolvedAt,
      resolvedServiceEntryId,
      notes: parsed.notes ?? null,
    },
  });

  await syncServiceEntryLink(
    issueId,
    vehicleId,
    original.resolvedServiceEntryId,
    resolvedServiceEntryId
  );

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/issues`);
  redirect(`/vehicles/${vehicleId}/issues`);
}

// -----------------------------------------------------------------------------
// Delete
// -----------------------------------------------------------------------------
export async function deleteIssue(vehicleId: string, issueId: string) {
  await requireVehicleOwnership(vehicleId);
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { vehicleId: true, resolvedServiceEntryId: true },
  });
  if (!issue || issue.vehicleId !== vehicleId) {
    throw new Error("Issue not found");
  }

  // If a service entry pointed to this issue as the fix, clear the reverse
  // link so we don't leave a dangling FK on the service entry.
  if (issue.resolvedServiceEntryId) {
    await prisma.serviceEntry
      .updateMany({
        where: {
          id: issue.resolvedServiceEntryId,
          vehicleId,
          resolvedIssueId: issueId,
        },
        data: { resolvedIssueId: null },
      })
      .catch(() => {
        // Best-effort — entry may have already been deleted.
      });
  }

  await prisma.issue.delete({ where: { id: issueId } });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/vehicles/${vehicleId}/issues`);
  redirect(`/vehicles/${vehicleId}/issues`);
}
