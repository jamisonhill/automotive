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
}) {
  const milesOn =
    currentMiles != null ? Math.max(0, currentMiles - set.installMileage) : null;
  const monthsOn = monthsBetween(set.installedAt, new Date());

  return (
    <Link
      href={`/vehicles/${vehicleId}/tires/${set.id}/edit`}
      className="block"
    >
      <Card className="p-4 active:bg-bg-overlay">
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
      </Card>
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
