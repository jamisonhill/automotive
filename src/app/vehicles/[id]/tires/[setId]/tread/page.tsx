import { ChevronRight, Gauge, Plus, TrendingDown } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import {
  minCorner,
  projectReplacement,
  treadBand,
  type TreadBand,
} from "@/lib/tread-projection";

/*
 * Tread depth log + replacement projection — scoped to a single
 * TireSet (not the vehicle as a whole), since a wear curve only makes
 * sense within one set's life.
 *
 * Layout:
 *   1. Projection hero — "X mi to replacement" when we have ≥2 readings.
 *      Empty / placeholder copy otherwise.
 *   2. Latest reading — full 4-corner grid with color-coded bands.
 *   3. History — older readings as compact rows.
 */
export default async function TreadDepthPage({
  params,
}: {
  params: Promise<{ id: string; setId: string }>;
}) {
  const { id, setId } = await params;

  const set = await prisma.tireSet.findFirst({
    where: { id: setId, vehicleId: id, vehicle: { isActive: true } },
    include: {
      vehicle: {
        select: {
          id: true,
          year: true,
          make: true,
          model: true,
          nickname: true,
          // Last reading drives "miles remaining" in the projection.
          odometerReadings: {
            orderBy: { recordedAt: "desc" },
            take: 1,
            select: { miles: true },
          },
        },
      },
    },
  });
  if (!set) notFound();

  const currentMileage = set.vehicle.odometerReadings[0]?.miles ?? null;

  const logs = await prisma.treadDepthLog.findMany({
    where: { tireSetId: setId },
    orderBy: { recordedAt: "desc" },
  });

  // Build the regression input: every reading reduced to (mileage,
  // min-corner depth). Worst corner drives the projection — that's the
  // first one to hit the replacement threshold under normal rotation.
  const projection = projectReplacement(
    logs.map((l) => ({ mileage: l.mileage, minDepth: minCorner(l) })),
    currentMileage
  );

  const [latest, ...older] = logs;

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Tread depth"
        subtitle={`${set.brand} ${set.model} · ${set.size}`}
        backHref={`/vehicles/${id}/tires`}
        actions={
          <Link href={`/vehicles/${id}/tires/${setId}/tread/new`}>
            <Button variant="primary" size="sm" aria-label="Log tread">
              <Plus className="h-4 w-4" />
            </Button>
          </Link>
        }
      />

      {/* Projection hero */}
      <ProjectionHero
        projection={projection}
        currentMileage={currentMileage}
      />

      {logs.length === 0 ? (
        <Card className="py-10 text-center">
          <Gauge className="mx-auto mb-3 h-8 w-8 text-fg-muted" />
          <p className="mb-4 text-fg-secondary">No tread readings yet.</p>
          <Link href={`/vehicles/${id}/tires/${setId}/tread/new`}>
            <Button>
              <Plus className="h-4 w-4" />
              Log tread
            </Button>
          </Link>
        </Card>
      ) : (
        <>
          <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-fg-secondary">
            Latest
          </h2>
          <LatestTreadCard
            vehicleId={id}
            setId={setId}
            log={latest}
          />

          {older.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-fg-secondary">
                History
              </h2>
              <div className="space-y-2">
                {older.map((log) => (
                  <TreadRow
                    key={log.id}
                    vehicleId={id}
                    setId={setId}
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
// Projection hero
// -----------------------------------------------------------------------------

function ProjectionHero({
  projection,
  currentMileage,
}: {
  projection: ReturnType<typeof projectReplacement>;
  currentMileage: number | null;
}) {
  if (projection.kind === "insufficient-data") {
    return (
      <Card className="mb-4 p-4">
        <p className="text-sm text-fg-secondary">
          {projection.sampleSize === 0
            ? "Add a tread reading to start tracking wear."
            : "One more reading and we can project replacement mileage."}
        </p>
      </Card>
    );
  }

  if (projection.kind === "no-wear") {
    return (
      <Card className="mb-4 p-4">
        <p className="text-sm text-fg-secondary">
          No measurable wear yet across {projection.sampleSize} readings.
          We'll project once a wear trend emerges.
        </p>
      </Card>
    );
  }

  // ok — we have a projection.
  const { milesRemaining, projectedMileage, sampleSize } = projection;
  const past = milesRemaining < 0;

  return (
    <Card className="mb-4 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-fg-muted">
            {past ? "Past replacement" : "Replace in"}
          </p>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              past ? "text-danger" : "text-fg-primary"
            }`}
          >
            {past
              ? `${formatMiles(Math.abs(milesRemaining))} over`
              : `${formatMiles(milesRemaining)}`}
          </p>
        </div>
        <TrendingDown
          className={`h-6 w-6 shrink-0 ${
            past ? "text-danger" : "text-fg-muted"
          }`}
        />
      </div>
      <p className="mt-2 text-xs text-fg-muted">
        At ~{formatMiles(Math.round(projectedMileage))}
        {currentMileage != null && (
          <> · current {currentMileage.toLocaleString()} mi</>
        )}
        {sampleSize >= 3 ? "" : " · low confidence (2 readings)"}
      </p>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Latest reading card
// -----------------------------------------------------------------------------

type TreadLog = {
  id: string;
  recordedAt: Date;
  mileage: number;
  fl: number;
  fr: number;
  rl: number;
  rr: number;
  notes: string | null;
};

function LatestTreadCard({
  vehicleId,
  setId,
  log,
}: {
  vehicleId: string;
  setId: string;
  log: TreadLog;
}) {
  return (
    <Link
      href={`/vehicles/${vehicleId}/tires/${setId}/tread/${log.id}/edit`}
      className="block"
    >
      <Card className="p-4 active:bg-bg-overlay">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <p className="text-base font-semibold text-fg-primary">
            {formatDate(log.recordedAt)}
          </p>
          <p className="text-xs text-fg-muted shrink-0 tabular-nums">
            {log.mileage.toLocaleString()} mi
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <CornerCell label="FL" depth={log.fl} />
          <CornerCell label="FR" depth={log.fr} />
          <CornerCell label="RL" depth={log.rl} />
          <CornerCell label="RR" depth={log.rr} />
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

function CornerCell({ label, depth }: { label: string; depth: number }) {
  const band = treadBand(depth);
  const cls = bandClasses(band);
  return (
    <div className={`rounded-md px-3 py-2 ${cls.bg}`}>
      <p className={`text-[10px] uppercase tracking-wider ${cls.label}`}>
        {label}
      </p>
      <p className={`text-base font-semibold tabular-nums ${cls.value}`}>
        {depth}
        <span className="text-xs font-normal opacity-60">/32</span>
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Compact history row
// -----------------------------------------------------------------------------

function TreadRow({
  vehicleId,
  setId,
  log,
}: {
  vehicleId: string;
  setId: string;
  log: TreadLog;
}) {
  const min = minCorner(log);
  const band = treadBand(min);
  const cls = bandClasses(band);
  return (
    <Link
      href={`/vehicles/${vehicleId}/tires/${setId}/tread/${log.id}/edit`}
      className="block"
    >
      <Card className="flex items-center gap-3 p-3 active:bg-bg-overlay">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-fg-primary">
            {formatDate(log.recordedAt)}
          </p>
          <p className="text-xs text-fg-secondary tabular-nums">
            {log.mileage.toLocaleString()} mi · min{" "}
            <span className={cls.value}>{min}/32</span>
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

/**
 * Tailwind class bundle for one band. Centralized so the LatestTreadCard,
 * TreadRow, and any future surface stay visually in sync.
 */
function bandClasses(band: TreadBand): {
  bg: string;
  label: string;
  value: string;
} {
  if (band === "replace") {
    return {
      bg: "bg-danger/15",
      label: "text-danger/70",
      value: "text-danger",
    };
  }
  if (band === "wearing") {
    return {
      bg: "bg-warning/15",
      label: "text-warning/70",
      value: "text-warning",
    };
  }
  return {
    bg: "bg-bg-overlay",
    label: "text-fg-muted",
    value: "text-fg-primary",
  };
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "2-digit",
  });
}

/**
 * Format a miles number compactly for the projection hero.
 *   42,500 → "42,500 mi"
 *   500    → "500 mi"
 * Rounded to the nearest 100 to avoid implying false precision in the
 * regression — we don't actually know the wear rate to within 1 mile.
 */
function formatMiles(n: number): string {
  const rounded = Math.round(n / 100) * 100;
  return `${rounded.toLocaleString()} mi`;
}
