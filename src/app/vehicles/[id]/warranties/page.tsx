import { ChevronRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { serviceLabel } from "@/lib/service-types";
import {
  computeWarrantyStatus,
  expirationSortKey,
  type WarrantyComputed,
  type WarrantyStatus,
} from "@/lib/warranties";

/*
 * Warranty tracking dashboard.
 *
 * Lists every service entry that has either warrantyMonths or
 * warrantyMiles set, and surfaces remaining time + miles for each.
 * Filter chips let the user scope to active / expiring / expired.
 *
 * Default filter is "active" — most of the time the user wants to know
 * what's still under warranty, not look at history.
 */

const VALID_FILTERS = ["active", "expiring", "expired"] as const;
type FilterValue = (typeof VALID_FILTERS)[number];

function isValidFilter(s: string | undefined): s is FilterValue {
  return s != null && (VALID_FILTERS as readonly string[]).includes(s);
}

export default async function WarrantiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { id } = await params;
  const { filter: filterParam } = await searchParams;
  // Default to "active" — most common landing intent.
  const activeFilter: FilterValue = isValidFilter(filterParam)
    ? filterParam
    : "active";

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

  const entries = await prisma.serviceEntry.findMany({
    where: {
      vehicleId: id,
      OR: [
        { warrantyMonths: { not: null } },
        { warrantyMiles: { not: null } },
      ],
    },
    orderBy: { performedAt: "desc" },
  });

  const now = new Date();
  const all: WarrantyComputed[] = [];
  for (const e of entries) {
    const w = computeWarrantyStatus(e, currentMiles, now);
    if (w) all.push(w);
  }

  const counts = {
    active: all.filter((w) => w.status === "active").length,
    expiring: all.filter((w) => w.status === "expiring").length,
    expired: all.filter((w) => w.status === "expired").length,
  };

  // Sort by earliest expiration first within each filter, so the user
  // sees the most urgent items at the top.
  const visible = all
    .filter((w) => w.status === activeFilter)
    .sort((a, b) => expirationSortKey(a) - expirationSortKey(b));

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Warranties"
        subtitle={
          vehicle.nickname ?? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        }
        backHref={`/vehicles/${vehicle.id}`}
      />

      {/* Filter chips */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <FilterChip
          href={`/vehicles/${vehicle.id}/warranties?filter=active`}
          label="Active"
          count={counts.active}
          active={activeFilter === "active"}
          tone="success"
        />
        <FilterChip
          href={`/vehicles/${vehicle.id}/warranties?filter=expiring`}
          label="Expiring soon"
          count={counts.expiring}
          active={activeFilter === "expiring"}
          tone="warning"
        />
        <FilterChip
          href={`/vehicles/${vehicle.id}/warranties?filter=expired`}
          label="Expired"
          count={counts.expired}
          active={activeFilter === "expired"}
          tone="muted"
        />
      </div>

      {visible.length === 0 ? (
        <Card className="py-10 text-center">
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-fg-muted" />
          <p className="text-fg-secondary">
            {emptyStateMessage(activeFilter, all.length)}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((w) => (
            <WarrantyCard
              key={w.entry.id}
              vehicleId={vehicle.id}
              warranty={w}
              currentMiles={currentMiles}
            />
          ))}
        </div>
      )}
    </main>
  );
}

// -----------------------------------------------------------------------------
// Cards & chips
// -----------------------------------------------------------------------------

function WarrantyCard({
  vehicleId,
  warranty,
  currentMiles,
}: {
  vehicleId: string;
  warranty: WarrantyComputed;
  currentMiles: number | null;
}) {
  const { entry, daysLeft, milesLeft, expiresAt, expiresMileage, status } =
    warranty;
  const label = serviceLabel(entry.serviceType, entry.customLabel);

  return (
    <Link
      href={`/vehicles/${vehicleId}/service/${entry.id}/edit`}
      className="block"
    >
      <Card className="p-3 active:bg-bg-overlay">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-semibold text-fg-primary truncate">{label}</p>
          <StatusPill status={status} />
        </div>
        <p className="mt-0.5 text-xs text-fg-secondary">
          Installed {formatDate(entry.performedAt)} ·{" "}
          {entry.odometer.toLocaleString()} mi
          {entry.partBrand ? ` · ${entry.partBrand}` : ""}
        </p>

        {/* Two-up countdown — only the dimensions actually tracked. */}
        <div className="mt-2 grid grid-cols-2 gap-2">
          {daysLeft != null && expiresAt && (
            <CountdownTile
              label="Time"
              value={formatTimeLeft(daysLeft)}
              sub={`Until ${formatDate(expiresAt)}`}
              expired={daysLeft <= 0}
            />
          )}
          {milesLeft != null && expiresMileage != null ? (
            <CountdownTile
              label="Miles"
              value={
                milesLeft > 0
                  ? `${milesLeft.toLocaleString()} mi`
                  : `${Math.abs(milesLeft).toLocaleString()} over`
              }
              sub={`Until ${expiresMileage.toLocaleString()} mi`}
              expired={milesLeft <= 0}
            />
          ) : entry.warrantyMiles != null && currentMiles == null ? (
            <CountdownTile
              label="Miles"
              value={`${entry.warrantyMiles.toLocaleString()} mi`}
              sub="No odometer reading on file"
              expired={false}
            />
          ) : null}
        </div>

        <div className="mt-2 flex items-center justify-end text-xs text-fg-muted">
          <span>View entry</span>
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </div>
      </Card>
    </Link>
  );
}

function CountdownTile({
  label,
  value,
  sub,
  expired,
}: {
  label: string;
  value: string;
  sub: string;
  expired: boolean;
}) {
  return (
    <div className="rounded-md bg-bg-overlay px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-fg-muted">
        {label}
      </p>
      <p
        className={`text-base font-semibold ${
          expired ? "text-danger" : "text-fg-primary"
        }`}
      >
        {value}
      </p>
      <p className="text-[11px] text-fg-secondary truncate">{sub}</p>
    </div>
  );
}

function FilterChip({
  href,
  label,
  count,
  active,
  tone,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  tone: "success" | "warning" | "muted";
}) {
  const countTone =
    count === 0
      ? "text-fg-muted"
      : tone === "success"
        ? "text-success"
        : tone === "warning"
          ? "text-warning"
          : "text-fg-secondary";
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-accent bg-accent/10 text-fg-primary"
          : "border-border-subtle bg-bg-elevated text-fg-secondary"
      }`}
    >
      <span>{label}</span>
      <span className={`text-xs font-semibold ${countTone}`}>{count}</span>
    </Link>
  );
}

function StatusPill({ status }: { status: WarrantyStatus }) {
  const cls =
    status === "active"
      ? "bg-success/15 text-success"
      : status === "expiring"
        ? "bg-warning/15 text-warning"
        : "bg-danger/15 text-danger";
  const label =
    status === "active"
      ? "Active"
      : status === "expiring"
        ? "Expiring"
        : "Expired";
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function emptyStateMessage(filter: FilterValue, totalTracked: number): string {
  if (totalTracked === 0) {
    return "No warranties tracked yet. Add warranty months or miles to a service entry to see it here.";
  }
  switch (filter) {
    case "active":
      return "No active warranties.";
    case "expiring":
      return "Nothing expiring in the next 90 days or 2,000 miles.";
    case "expired":
      return "No expired warranties on file.";
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Human-friendly time-left readout. Negative days render as "expired
 * N days ago" so the card communicates state at a glance.
 */
function formatTimeLeft(days: number): string {
  if (days <= 0) {
    const past = Math.abs(days);
    if (past < 60) return `${past} days over`;
    if (past < 730) return `${Math.round(past / 30)} mo over`;
    return `${(past / 365).toFixed(1)} yr over`;
  }
  if (days < 60) return `${days} days`;
  if (days < 730) return `${Math.round(days / 30)} mo`;
  return `${(days / 365).toFixed(1)} yr`;
}
