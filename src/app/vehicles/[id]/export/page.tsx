import { Download } from "lucide-react";
import { notFound } from "next/navigation";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";

/*
 * Export center — one row per dataset with a count and a Download
 * link. Each link hits the /api/export/{vehicleId}/{dataset} route,
 * which sets Content-Disposition so the browser saves the file rather
 * than navigating to it.
 *
 * Counts are surfaced so the user can tell at a glance whether a
 * dataset has anything to export. The query is one round-trip via
 * count() per dataset — small enough that this is fine.
 */
const DATASETS: { id: string; title: string; description: string }[] = [
  {
    id: "fuel",
    title: "Fuel entries",
    description: "Every fill-up with MPG, cost, and station.",
  },
  {
    id: "service",
    title: "Service entries",
    description: "Routine maintenance, repairs, inspections.",
  },
  {
    id: "tires",
    title: "Tire sets",
    description: "Install + removal records, brand/model/size, cost.",
  },
  {
    id: "reminders",
    title: "Reminders",
    description: "Interval-based service reminders and last-done state.",
  },
  {
    id: "issues",
    title: "Issues / DTCs",
    description: "Symptoms and diagnostic codes you've tracked.",
  },
  {
    id: "odometer",
    title: "Odometer readings",
    description: "Canonical mileage timeline (manual + auto from logs).",
  },
];

export default async function ExportPage({
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

  // Six small count() calls in parallel. Cheaper than fetching rows.
  const [fuel, service, tires, reminders, issues, odometer] =
    await Promise.all([
      prisma.fuelEntry.count({ where: { vehicleId: id } }),
      prisma.serviceEntry.count({ where: { vehicleId: id } }),
      prisma.tireSet.count({ where: { vehicleId: id } }),
      prisma.reminder.count({ where: { vehicleId: id } }),
      prisma.issue.count({ where: { vehicleId: id } }),
      prisma.odometerReading.count({ where: { vehicleId: id } }),
    ]);

  const counts: Record<string, number> = {
    fuel,
    service,
    tires,
    reminders,
    issues,
    odometer,
  };

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Export data"
        subtitle={
          vehicle.nickname ?? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        }
        backHref={`/vehicles/${vehicle.id}`}
      />

      <p className="mb-4 text-sm text-fg-secondary">
        Download any dataset as a CSV. Files open directly in Numbers,
        Excel, or Google Sheets.
      </p>

      <div className="space-y-2">
        {DATASETS.map((d) => {
          const n = counts[d.id] ?? 0;
          const href = `/api/export/${vehicle.id}/${d.id}`;
          return (
            // Plain anchor (not next/link) — we want the browser to
            // follow the response's Content-Disposition rather than
            // attempt client-side navigation.
            <a key={d.id} href={href} download className="block">
              <Card className="flex items-center gap-3 p-3 active:bg-bg-overlay">
                <div className="rounded-md bg-bg-overlay p-2">
                  <Download className="h-5 w-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">{d.title}</CardTitle>
                  <CardDescription>{d.description}</CardDescription>
                </div>
                <span className="rounded-full bg-bg-overlay px-2 py-0.5 text-xs font-semibold text-fg-secondary tabular-nums">
                  {n.toLocaleString()}
                </span>
              </Card>
            </a>
          );
        })}
      </div>
    </main>
  );
}
