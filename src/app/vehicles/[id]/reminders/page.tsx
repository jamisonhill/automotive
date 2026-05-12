import { Bell, ChevronRight, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { seedCommonReminders } from "@/app/actions/reminders";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import {
  computeReminderStatus,
  urgencySortKey,
  type ReminderComputed,
  type ReminderStatus,
} from "@/lib/reminders";

/*
 * Reminders list. Active reminders rendered first, sorted by urgency
 * (overdue at the top); paused reminders below in a quieter section.
 *
 * For each active reminder we compute the live status from:
 *   - Reminder row (intervals + manual lastDone overrides)
 *   - All matching ServiceEntry rows (auto-advance source)
 *   - Vehicle's most-recent odometer (drives miles-remaining)
 */
export default async function RemindersPage({
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
      nickname: true,
      odometerReadings: {
        orderBy: { recordedAt: "desc" },
        take: 1,
        select: { miles: true },
      },
    },
  });
  if (!vehicle) notFound();
  const currentMiles = vehicle.odometerReadings[0]?.miles ?? null;

  // Pull every reminder + every service entry in one round-trip; we
  // group in memory. Reminder volume per vehicle is small (≤ 20 even
  // for diligent owners), so this is cheap.
  const [reminders, serviceEntries] = await Promise.all([
    prisma.reminder.findMany({
      where: { vehicleId: id },
      orderBy: { label: "asc" },
    }),
    prisma.serviceEntry.findMany({
      where: { vehicleId: id },
      orderBy: { performedAt: "desc" },
      select: { serviceType: true, performedAt: true, odometer: true },
    }),
  ]);

  // Index service entries by serviceType so each reminder can pull its
  // matching slice in O(1) rather than rescanning the full list.
  const serviceByType = new Map<
    string,
    { performedAt: Date; odometer: number }[]
  >();
  for (const e of serviceEntries) {
    const list = serviceByType.get(e.serviceType) ?? [];
    list.push({ performedAt: e.performedAt, odometer: e.odometer });
    serviceByType.set(e.serviceType, list);
  }

  const computed = reminders.map((r) =>
    computeReminderStatus(
      r,
      r.serviceType ? (serviceByType.get(r.serviceType) ?? []) : [],
      currentMiles
    )
  );

  const active = computed
    .filter((c) => c.reminder.isActive)
    .sort((a, b) => urgencySortKey(a) - urgencySortKey(b));
  const paused = computed.filter((c) => !c.reminder.isActive);

  const overdueCount = active.filter((c) => c.status === "overdue").length;
  const dueSoonCount = active.filter((c) => c.status === "due_soon").length;

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Reminders"
        subtitle={
          vehicle.nickname ?? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        }
        backHref={`/vehicles/${vehicle.id}`}
        actions={
          <Link href={`/vehicles/${vehicle.id}/reminders/new`}>
            <Button variant="primary" size="sm" aria-label="Add reminder">
              <Plus className="h-4 w-4" />
            </Button>
          </Link>
        }
      />

      {/* Headline counts so the user knows at a glance. Only renders
          when there's at least one alert state to show. */}
      {(overdueCount > 0 || dueSoonCount > 0) && (
        <div className="mb-4 flex gap-2 text-xs">
          {overdueCount > 0 && (
            <span className="rounded-full bg-danger/15 px-2.5 py-1 font-semibold text-danger">
              {overdueCount} overdue
            </span>
          )}
          {dueSoonCount > 0 && (
            <span className="rounded-full bg-warning/15 px-2.5 py-1 font-semibold text-warning">
              {dueSoonCount} due soon
            </span>
          )}
        </div>
      )}

      {active.length === 0 && paused.length === 0 ? (
        <Card className="py-10 text-center">
          <Bell className="mx-auto mb-3 h-8 w-8 text-fg-muted" />
          <p className="mb-4 text-fg-secondary">No reminders set.</p>
          <div className="flex flex-col items-center gap-2">
            <Link href={`/vehicles/${vehicle.id}/reminders/new`}>
              <Button>
                <Plus className="h-4 w-4" />
                Add reminder
              </Button>
            </Link>
            {/* Seed action — bound to vehicleId so the button just submits.
                Idempotent: the action skips serviceTypes already present,
                so re-clicking will never duplicate rows. */}
            <form action={seedCommonReminders.bind(null, vehicle.id)}>
              <Button type="submit" variant="ghost" size="sm">
                <Sparkles className="h-4 w-4" />
                Add common reminders
              </Button>
            </form>
          </div>
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <div className="space-y-2">
              {active.map((c) => (
                <ReminderRow
                  key={c.reminder.id}
                  vehicleId={vehicle.id}
                  computed={c}
                />
              ))}
            </div>
          )}

          {paused.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-fg-secondary">
                Paused
              </h2>
              <div className="space-y-2">
                {paused.map((c) => (
                  <ReminderRow
                    key={c.reminder.id}
                    vehicleId={vehicle.id}
                    computed={c}
                    paused
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}

// -----------------------------------------------------------------------------
// Row
// -----------------------------------------------------------------------------

function ReminderRow({
  vehicleId,
  computed,
  paused = false,
}: {
  vehicleId: string;
  computed: ReminderComputed;
  paused?: boolean;
}) {
  const { reminder, milesRemaining, daysRemaining, status } = computed;

  return (
    <Link
      href={`/vehicles/${vehicleId}/reminders/${reminder.id}/edit`}
      className="block"
    >
      <Card
        className={`flex items-center gap-3 p-3 active:bg-bg-overlay ${
          paused ? "opacity-60" : ""
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-semibold text-fg-primary truncate">
              {reminder.label}
            </p>
            {!paused && <StatusPill status={status} />}
          </div>
          <p className="mt-1 text-xs text-fg-secondary">
            {describeRemaining(milesRemaining, daysRemaining)}
            {describeInterval(
              reminder.intervalMiles,
              reminder.intervalMonths
            ) && (
              <span className="text-fg-muted">
                {" · "}
                {describeInterval(
                  reminder.intervalMiles,
                  reminder.intervalMonths
                )}
              </span>
            )}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-fg-muted" />
      </Card>
    </Link>
  );
}

function StatusPill({ status }: { status: ReminderStatus }) {
  if (status === "overdue") {
    return (
      <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-danger">
        Overdue
      </span>
    );
  }
  if (status === "due_soon") {
    return (
      <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-warning">
        Due soon
      </span>
    );
  }
  if (status === "no_data") {
    return (
      <span className="rounded-full bg-bg-overlay px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
        No data
      </span>
    );
  }
  return null;
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

/**
 * Render the "X mi · Y days" line on a row. Emit whichever dimensions
 * we have data for; pluralize naturally; fall back to a friendly
 * placeholder when neither dimension is computable.
 */
function describeRemaining(
  miles: number | null,
  days: number | null
): string {
  const parts: string[] = [];
  if (miles != null) {
    if (miles < 0) {
      parts.push(`${Math.abs(miles).toLocaleString()} mi over`);
    } else {
      parts.push(`${miles.toLocaleString()} mi`);
    }
  }
  if (days != null) {
    if (days < 0) {
      parts.push(`${Math.abs(days)} days over`);
    } else if (days === 1) {
      parts.push("1 day");
    } else {
      parts.push(`${days} days`);
    }
  }
  if (parts.length === 0) return "No last-done data yet";
  return parts.join(" · ");
}

/**
 * Compact "every 5,000 mi / 6 mo" sub-line. Only the dimensions actually
 * set on the reminder appear.
 */
function describeInterval(
  miles: number | null,
  months: number | null
): string | null {
  const parts: string[] = [];
  if (miles != null) parts.push(`${miles.toLocaleString()} mi`);
  if (months != null) parts.push(`${months} mo`);
  if (parts.length === 0) return null;
  return `every ${parts.join(" / ")}`;
}
