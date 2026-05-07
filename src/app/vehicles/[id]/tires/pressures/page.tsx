import { ChevronRight, Gauge, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";

/*
 * Pressure log list — most-recent reading up top with the full 4-corner
 * grid (and any before→after delta), older readings in compact rows below.
 *
 * Pressure logs aren't a high-volume feed (a careful owner might log a
 * dozen per year), so we render them all in JS without pagination.
 */
export default async function PressureLogsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, isActive: true },
    select: { id: true, year: true, make: true, model: true, nickname: true },
  });
  if (!vehicle) notFound();

  const logs = await prisma.tirePressureLog.findMany({
    where: { vehicleId: id },
    orderBy: { recordedAt: "desc" },
    include: {
      tireSet: {
        select: { id: true, brand: true, model: true, size: true },
      },
    },
  });

  const [latest, ...older] = logs;

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Tire pressures"
        subtitle={
          vehicle.nickname ?? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        }
        backHref={`/vehicles/${vehicle.id}/tires`}
        actions={
          <Link href={`/vehicles/${vehicle.id}/tires/pressures/new`}>
            <Button variant="primary" size="sm" aria-label="Log pressures">
              <Plus className="h-4 w-4" />
            </Button>
          </Link>
        }
      />

      {logs.length === 0 ? (
        <Card className="py-10 text-center">
          <Gauge className="mx-auto mb-3 h-8 w-8 text-fg-muted" />
          <p className="mb-4 text-fg-secondary">No pressure checks yet.</p>
          <Link href={`/vehicles/${vehicle.id}/tires/pressures/new`}>
            <Button>
              <Plus className="h-4 w-4" />
              Log pressures
            </Button>
          </Link>
        </Card>
      ) : (
        <>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-secondary">
            Latest
          </h2>
          <LatestPressureCard vehicleId={vehicle.id} log={latest} />

          {older.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-fg-secondary">
                History
              </h2>
              <div className="space-y-2">
                {older.map((log) => (
                  <PressureLogRow
                    key={log.id}
                    vehicleId={vehicle.id}
                    log={log}
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
// Latest reading — full 4-corner grid with before→after deltas
// -----------------------------------------------------------------------------

type LogWithTireSet = {
  id: string;
  recordedAt: Date;
  ambientF: number | null;
  flBefore: number | null;
  frBefore: number | null;
  rlBefore: number | null;
  rrBefore: number | null;
  flAfter: number | null;
  frAfter: number | null;
  rlAfter: number | null;
  rrAfter: number | null;
  notes: string | null;
  tireSet: {
    id: string;
    brand: string;
    model: string;
    size: string;
  } | null;
};

function LatestPressureCard({
  vehicleId,
  log,
}: {
  vehicleId: string;
  log: LogWithTireSet;
}) {
  return (
    <Link
      href={`/vehicles/${vehicleId}/tires/pressures/${log.id}/edit`}
      className="block"
    >
      <Card className="p-4 active:bg-bg-overlay">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <div>
            <p className="text-base font-semibold text-fg-primary">
              {formatDateTime(log.recordedAt)}
            </p>
            {log.tireSet && (
              <p className="text-xs text-fg-secondary">
                {log.tireSet.brand} {log.tireSet.model} · {log.tireSet.size}
              </p>
            )}
          </div>
          {log.ambientF != null && (
            <p className="text-xs text-fg-muted shrink-0">
              {Math.round(log.ambientF)}°F
            </p>
          )}
        </div>

        {/* 2x2 corner grid mirrors the car looking down. */}
        <div className="grid grid-cols-2 gap-2">
          <CornerReadout
            label="FL"
            before={log.flBefore}
            after={log.flAfter}
          />
          <CornerReadout
            label="FR"
            before={log.frBefore}
            after={log.frAfter}
          />
          <CornerReadout
            label="RL"
            before={log.rlBefore}
            after={log.rlAfter}
          />
          <CornerReadout
            label="RR"
            before={log.rrBefore}
            after={log.rrAfter}
          />
        </div>

        {log.notes && (
          <p className="mt-3 text-xs text-fg-secondary line-clamp-2">
            {log.notes}
          </p>
        )}
      </Card>
    </Link>
  );
}

function CornerReadout({
  label,
  before,
  after,
}: {
  label: string;
  before: number | null;
  after: number | null;
}) {
  // Show before→after when both present; otherwise just whichever exists.
  const hasBoth = before != null && after != null;
  const display = hasBoth
    ? `${formatPsi(before)} → ${formatPsi(after)}`
    : before != null
      ? formatPsi(before)
      : after != null
        ? formatPsi(after)
        : "—";

  // Delta hint when both readings exist — a positive number = added air.
  const delta = hasBoth ? after! - before! : null;

  return (
    <div className="rounded-md bg-bg-overlay px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-fg-muted">
        {label}
      </p>
      <p className="text-sm font-semibold text-fg-primary tabular-nums">
        {display}
      </p>
      {delta != null && delta !== 0 && (
        <p
          className={`text-[11px] tabular-nums ${
            delta > 0 ? "text-success" : "text-warning"
          }`}
        >
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)} psi
        </p>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Compact history row
// -----------------------------------------------------------------------------

function PressureLogRow({
  vehicleId,
  log,
}: {
  vehicleId: string;
  log: LogWithTireSet;
}) {
  // Pick "the" reading per corner: prefer After when present (final state),
  // otherwise Before. Compact summary shows F-avg / R-avg.
  const fl = log.flAfter ?? log.flBefore;
  const fr = log.frAfter ?? log.frBefore;
  const rl = log.rlAfter ?? log.rlBefore;
  const rr = log.rrAfter ?? log.rrBefore;
  const frontAvg = avgOf(fl, fr);
  const rearAvg = avgOf(rl, rr);

  return (
    <Link
      href={`/vehicles/${vehicleId}/tires/pressures/${log.id}/edit`}
      className="block"
    >
      <Card className="flex items-center gap-3 p-3 active:bg-bg-overlay">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-fg-primary">
            {formatDateTime(log.recordedAt)}
          </p>
          <p className="text-xs text-fg-secondary tabular-nums">
            F {fmtAvg(frontAvg)} · R {fmtAvg(rearAvg)}
            {log.ambientF != null ? ` · ${Math.round(log.ambientF)}°F` : ""}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-fg-muted" />
      </Card>
    </Link>
  );
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function formatPsi(v: number): string {
  // PSI is usually shown to one decimal place, but if the user entered an
  // integer don't add a fake ".0".
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function avgOf(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return (a + b) / 2;
}

function fmtAvg(v: number | null): string {
  return v == null ? "—" : formatPsi(Math.round(v * 10) / 10);
}

function formatDateTime(d: Date): string {
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}
