import {
  AlertCircle,
  AlertTriangle,
  Car,
  ChevronRight,
  Disc,
  Fuel,
  Gauge,
  Pencil,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { getVehicle } from "@/lib/queries";

/*
 * Vehicle detail dashboard.
 *
 * Layout:
 *   - Sticky header with back-to-garage and an "Edit" action
 *   - Hero: photo, identity, latest mileage, baseline status
 *   - Section tiles: Baseline, Fuel, Service, Tires, Issues
 *
 * In Phase 2 only "Baseline" links somewhere real; the rest are placeholders
 * with "Coming in Phase N" copy. We render them now so the navigation shape
 * is locked in and we can wire each up incrementally.
 */
export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vehicle = await getVehicle(id);
  if (!vehicle) notFound();

  const latestMiles = vehicle.odometerReadings[0]?.miles;
  const hasBaseline = vehicle.baseline != null;
  const lastFuel = vehicle.fuelEntries[0] ?? null;
  const lastService = vehicle.serviceEntries[0] ?? null;
  const openIssues = vehicle.openIssueCount;
  const warranties = vehicle.warrantySummary;

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
        subtitle={vehicle.nickname ?? vehicle.trim ?? undefined}
        backHref="/"
        backLabel="Garage"
        actions={
          <Link href={`/vehicles/${vehicle.id}/edit`}>
            <Button variant="ghost" size="sm" aria-label="Edit vehicle">
              <Pencil className="h-4 w-4" />
            </Button>
          </Link>
        }
      />

      {/* Hero — photo + key facts */}
      <Card className="mb-4 overflow-hidden p-0">
        <div className="aspect-[16/10] w-full bg-bg-overlay">
          {vehicle.photoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/photos/${vehicle.photoPath}`}
              alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Car className="h-12 w-12 text-fg-muted" />
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 divide-x divide-border-subtle border-t border-border-subtle">
          <Stat
            label="Odometer"
            value={
              latestMiles != null ? `${latestMiles.toLocaleString()} mi` : "—"
            }
          />
          <Stat
            label="Baseline"
            value={hasBaseline ? "Recorded" : "Not yet"}
            tone={hasBaseline ? "default" : "warning"}
          />
        </div>
      </Card>

      {/* Section tiles — primary navigation */}
      <div className="space-y-2">
        <SectionTile
          href={`/vehicles/${vehicle.id}/baseline`}
          icon={<AlertTriangle className="h-5 w-5 text-warning" />}
          title="Baseline condition"
          description={
            hasBaseline
              ? `Captured at ${vehicle.baseline?.mileageAtBaseline.toLocaleString()} mi`
              : "Snapshot the car's condition as a starting point"
          }
        />
        <SectionTile
          href={`/vehicles/${vehicle.id}/fuel`}
          icon={<Fuel className="h-5 w-5 text-accent" />}
          title="Fuel & MPG"
          description={
            lastFuel
              ? lastFuel.tripMpg != null
                ? `Last fill: ${lastFuel.tripMpg.toFixed(1)} mpg`
                : "Tap to add another fill-up"
              : "Log your first fill-up"
          }
        />
        <SectionTile
          href={`/vehicles/${vehicle.id}/service`}
          icon={<Wrench className="h-5 w-5 text-accent" />}
          title="Service & repairs"
          description={
            lastService
              ? `Last: ${lastService.performedAt.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "2-digit",
                })}`
              : "Log oil changes, repairs, inspections"
          }
        />
        <SectionTile
          href={`/vehicles/${vehicle.id}/warranties${
            warranties.expiring > 0 ? "?filter=expiring" : ""
          }`}
          icon={
            <ShieldCheck
              className={`h-5 w-5 ${
                warranties.expiring > 0 ? "text-warning" : "text-accent"
              }`}
            />
          }
          title="Warranties"
          description={
            warranties.active === 0 &&
            warranties.expiring === 0 &&
            warranties.expired === 0
              ? "No warranties tracked yet"
              : warranties.expiring > 0
                ? `${warranties.expiring} expiring soon · ${warranties.active} active`
                : `${warranties.active} active`
          }
          badge={warranties.expiring > 0 ? warranties.expiring : undefined}
        />
        <SectionTile
          icon={<Disc className="h-5 w-5 text-fg-muted" />}
          title="Tires"
          description="Coming in Phase 5"
          disabled
        />
        <SectionTile
          href={`/vehicles/${vehicle.id}/issues`}
          icon={
            <AlertCircle
              className={`h-5 w-5 ${
                openIssues > 0 ? "text-warning" : "text-accent"
              }`}
            />
          }
          title="Issues & DTCs"
          description={
            openIssues > 0
              ? `${openIssues} open`
              : "Track symptoms, DTCs, and resolutions"
          }
          badge={openIssues > 0 ? openIssues : undefined}
        />
        <SectionTile
          icon={<Gauge className="h-5 w-5 text-fg-muted" />}
          title="Reminders"
          description="Coming in Phase 6"
          disabled
        />
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-fg-muted">
        {label}
      </p>
      <p
        className={`text-base font-semibold ${
          tone === "warning" ? "text-warning" : "text-fg-primary"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

interface SectionTileProps {
  href?: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
  badge?: number;
}

function SectionTile({
  href,
  icon,
  title,
  description,
  disabled,
  badge,
}: SectionTileProps) {
  const inner = (
    <Card
      className={`flex items-center gap-3 p-3 ${
        disabled ? "opacity-50" : "active:bg-bg-overlay"
      }`}
    >
      <div className="rounded-md bg-bg-overlay p-2">{icon}</div>
      <div className="flex-1 min-w-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </div>
      {badge != null && badge > 0 && (
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-warning/15 px-2 text-xs font-semibold text-warning">
          {badge}
        </span>
      )}
      {!disabled && (
        <ChevronRight className="h-5 w-5 shrink-0 text-fg-muted" />
      )}
    </Card>
  );

  if (disabled || !href) return inner;
  return (
    <Link href={href} className="block">
      {inner}
    </Link>
  );
}
