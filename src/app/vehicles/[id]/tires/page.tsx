import { ChevronRight, Disc, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";

/*
 * Tires list — current set up top, history below.
 *
 * "Current" = the active tire set (no removedAt). At most one is shown.
 * History = removed sets, ordered most-recent removal first. Includes
 * any additional active sets if the user opted out of auto-closing on
 * install (e.g. dedicated snow set tracked alongside summers).
 */
export default async function TiresPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, isActive: true },
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

  // Newest install first across the board — we'll separate active vs.
  // removed in JS.
  const sets = await prisma.tireSet.findMany({
    where: { vehicleId: id },
    orderBy: { installedAt: "desc" },
  });

  // The "current" pick — newest active set. Any other active sets fall
  // into the auxiliary list (e.g. seasonal swap).
  const current = sets.find((s) => s.removedAt == null) ?? null;

  // Latest pressure log scoped to the current set, used to surface a
  // "Last checked" row on the Current card. Scoped per-set (not per-
  // vehicle) so a stale check from the previous set doesn't bleed into
  // the new set after a seasonal swap.
  const latestPressure = current
    ? await prisma.tirePressureLog.findFirst({
        where: { vehicleId: id, tireSetId: current.id },
        orderBy: { recordedAt: "desc" },
      })
    : null;
  const auxiliaryActive = sets.filter(
    (s) => s.removedAt == null && s.id !== current?.id
  );
  const removed = sets
    .filter((s) => s.removedAt != null)
    .sort((a, b) => (b.removedAt!.getTime() - a.removedAt!.getTime()));

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Tires"
        subtitle={
          vehicle.nickname ?? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        }
        backHref={`/vehicles/${vehicle.id}`}
        actions={
          <Link href={`/vehicles/${vehicle.id}/tires/new`}>
            <Button variant="primary" size="sm" aria-label="Install tires">
              <Plus className="h-4 w-4" />
            </Button>
          </Link>
        }
      />

      {/* Current set */}
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-secondary">
        Current
      </h2>
      {current ? (
        <CurrentTireSetCard
          vehicleId={vehicle.id}
          set={current}
          currentMiles={currentMiles}
          latestPressure={latestPressure}
        />
      ) : (
        <Card className="py-8 text-center">
          <Disc className="mx-auto mb-3 h-8 w-8 text-fg-muted" />
          <p className="mb-4 text-fg-secondary">No tires on the car.</p>
          <Link href={`/vehicles/${vehicle.id}/tires/new`}>
            <Button>
              <Plus className="h-4 w-4" />
              Install tires
            </Button>
          </Link>
        </Card>
      )}

      {/* Auxiliary active sets — uncommon but supported (e.g. snows). */}
      {auxiliaryActive.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-fg-secondary">
            Other active sets
          </h2>
          <div className="space-y-2">
            {auxiliaryActive.map((s) => (
              <TireSetRow key={s.id} vehicleId={vehicle.id} set={s} />
            ))}
          </div>
        </>
      )}

      {/* History */}
      {removed.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-fg-secondary">
            History
          </h2>
          <div className="space-y-2">
            {removed.map((s) => (
              <TireSetRow key={s.id} vehicleId={vehicle.id} set={s} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

// -----------------------------------------------------------------------------
// Cards
// -----------------------------------------------------------------------------

function CurrentTireSetCard({
  vehicleId,
  set,
  currentMiles,
  latestPressure,
}: {
  vehicleId: string;
  set: {
    id: string;
    brand: string;
    model: string;
    size: string;
    installedAt: Date;
    installMileage: number;
    cost: number | null;
  };
  currentMiles: number | null;
  latestPressure: {
    recordedAt: Date;
    flBefore: number | null;
    frBefore: number | null;
    rlBefore: number | null;
    rrBefore: number | null;
    flAfter: number | null;
    frAfter: number | null;
    rlAfter: number | null;
    rrAfter: number | null;
  } | null;
}) {
  const milesOn =
    currentMiles != null ? Math.max(0, currentMiles - set.installMileage) : null;
  const monthsOn = monthsBetween(set.installedAt, new Date());

  // Two sibling <Link>s inside one Card — never nest anchors. Top half
  // jumps to edit; bottom "Last checked" row jumps to the pressure log.
  return (
    <Card className="overflow-hidden">
      <Link
        href={`/vehicles/${vehicleId}/tires/${set.id}/edit`}
        className="block p-4 active:bg-bg-overlay"
      >
        <p className="text-base font-semibold text-fg-primary">
          {set.brand} {set.model}
        </p>
        <p className="text-sm text-fg-secondary">{set.size}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat
            label="On the car"
            value={milesOn != null ? `${milesOn.toLocaleString()} mi` : "—"}
            sub={`${monthsOn} mo`}
          />
          <Stat
            label="Installed"
            value={set.installMileage.toLocaleString() + " mi"}
            sub={formatDate(set.installedAt)}
          />
        </div>
      </Link>
      <PressureSummaryRow
        vehicleId={vehicleId}
        latestPressure={latestPressure}
      />
    </Card>
  );
}

/**
 * "Last checked: 3 days ago · F 32/32 · R 30/30" row at the bottom of
 * the Current card. When there's no log, surfaces an empty-state CTA so
 * the user discovers the feature without having to dig.
 */
function PressureSummaryRow({
  vehicleId,
  latestPressure,
}: {
  vehicleId: string;
  latestPressure: {
    recordedAt: Date;
    flBefore: number | null;
    frBefore: number | null;
    rlBefore: number | null;
    rrBefore: number | null;
    flAfter: number | null;
    frAfter: number | null;
    rlAfter: number | null;
    rrAfter: number | null;
  } | null;
}) {
  const href = `/vehicles/${vehicleId}/tires/pressures`;

  if (!latestPressure) {
    return (
      <Link
        href={href}
        className="block border-t border-border-subtle px-4 py-3 text-sm text-fg-secondary active:bg-bg-overlay"
      >
        Log tire pressures →
      </Link>
    );
  }

  // Prefer After when present (final state); otherwise Before. Same
  // logic as the pressure-list compact row.
  const fl = latestPressure.flAfter ?? latestPressure.flBefore;
  const fr = latestPressure.frAfter ?? latestPressure.frBefore;
  const rl = latestPressure.rlAfter ?? latestPressure.rlBefore;
  const rr = latestPressure.rrAfter ?? latestPressure.rrBefore;
  const front = pairText(fl, fr);
  const rear = pairText(rl, rr);

  return (
    <Link
      href={href}
      className="block border-t border-border-subtle px-4 py-3 active:bg-bg-overlay"
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-fg-secondary">
          Checked {timeAgo(latestPressure.recordedAt)}
        </span>
        <span className="text-fg-primary tabular-nums shrink-0">
          F {front} · R {rear}
        </span>
      </div>
    </Link>
  );
}

function TireSetRow({
  vehicleId,
  set,
}: {
  vehicleId: string;
  set: {
    id: string;
    brand: string;
    model: string;
    size: string;
    installedAt: Date;
    installMileage: number;
    removedAt: Date | null;
    removeMileage: number | null;
    removeReason: string | null;
  };
}) {
  const lifeMiles =
    set.removedAt != null && set.removeMileage != null
      ? set.removeMileage - set.installMileage
      : null;

  return (
    <Link
      href={`/vehicles/${vehicleId}/tires/${set.id}/edit`}
      className="block"
    >
      <Card className="flex items-center gap-3 p-3 active:bg-bg-overlay">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-fg-primary truncate">
            {set.brand} {set.model}
          </p>
          <p className="text-xs text-fg-secondary">
            {set.size} · {formatDate(set.installedAt)}
            {set.removedAt
              ? ` → ${formatDate(set.removedAt)}`
              : " (active)"}
          </p>
          {lifeMiles != null && (
            <p className="text-xs text-fg-muted">
              {lifeMiles.toLocaleString()} mi of service
              {set.removeReason ? ` · ${set.removeReason}` : ""}
            </p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-fg-muted" />
      </Card>
    </Link>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md bg-bg-overlay px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-fg-muted">
        {label}
      </p>
      <p className="text-base font-semibold text-fg-primary">{value}</p>
      {sub && <p className="text-[11px] text-fg-secondary truncate">{sub}</p>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "2-digit",
  });
}

/** Approximate months between two dates (≈30.4 days/month). */
function monthsBetween(a: Date, b: Date): number {
  const days = (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.round(days / 30.4));
}

/**
 * Short PSI for one corner — integer when whole, one decimal otherwise.
 * "—" placeholder when the corner wasn't logged on this entry.
 */
function fmtPsi(v: number | null): string {
  if (v == null) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** "32/32" style two-corner summary used in the Current card row. */
function pairText(a: number | null, b: number | null): string {
  return `${fmtPsi(a)}/${fmtPsi(b)}`;
}

/**
 * Coarse "X ago" formatter for the Current card.
 * Reads naturally on a glance — "today", "yesterday", "3 days ago",
 * "2 weeks ago", or a calendar date for older entries.
 */
function timeAgo(d: Date): string {
  const days = Math.floor(
    (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const wks = Math.floor(days / 7);
    return wks === 1 ? "1 week ago" : `${wks} weeks ago`;
  }
  return formatDate(d);
}
