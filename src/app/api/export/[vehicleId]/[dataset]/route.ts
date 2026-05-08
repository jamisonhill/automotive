import { NextResponse } from "next/server";

import { toCsv, type CsvColumn } from "@/lib/csv";
import { prisma } from "@/lib/db";

/*
 * CSV export — one route handler that dispatches by dataset.
 *
 *   GET /api/export/{vehicleId}/{dataset}
 *
 * Datasets:
 *   fuel | service | tires | reminders | issues | odometer
 *
 * The Cloudflare Access proxy gates the request, so we trust the
 * caller is the owner. Dataset is validated against the allowlist
 * before any DB call so a typo can't land us with an invalid query.
 */

const DATASETS = [
  "fuel",
  "service",
  "tires",
  "reminders",
  "issues",
  "odometer",
] as const;
type Dataset = (typeof DATASETS)[number];

function isDataset(s: string): s is Dataset {
  return (DATASETS as readonly string[]).includes(s);
}

/**
 * Slug-ify a vehicle for the suggested filename. We don't depend on
 * any one field — pick the most identifying available so the user sees
 * something useful in their downloads folder.
 */
function vehicleSlug(v: {
  nickname: string | null;
  year: number;
  make: string;
  model: string;
}): string {
  const raw = v.nickname?.trim() || `${v.year}-${v.make}-${v.model}`;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ vehicleId: string; dataset: string }> }
) {
  const { vehicleId, dataset } = await params;

  if (!isDataset(dataset)) {
    return new NextResponse("Unknown dataset", { status: 400 });
  }

  // Confirm the vehicle exists and is active. We need the identifying
  // fields anyway for the filename slug.
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, isActive: true },
    select: { id: true, year: true, make: true, model: true, nickname: true },
  });
  if (!vehicle) {
    return new NextResponse("Vehicle not found", { status: 404 });
  }

  const csv = await buildCsv(vehicleId, dataset);
  const filename = `automotive-${vehicleSlug(vehicle)}-${dataset}-${todayStamp()}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Each export is a fresh read; no caching.
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Per-dataset query + column shape. Kept inline (rather than split
 * into separate files) because each block is small and reading them
 * side-by-side makes it easy to keep the column ordering consistent.
 */
async function buildCsv(vehicleId: string, dataset: Dataset): Promise<string> {
  switch (dataset) {
    case "fuel": {
      const rows = await prisma.fuelEntry.findMany({
        where: { vehicleId },
        orderBy: { filledAt: "asc" },
      });
      const cols: CsvColumn<(typeof rows)[number]>[] = [
        { header: "filled_at", value: (r) => r.filledAt },
        { header: "odometer", value: (r) => r.odometer },
        { header: "gallons", value: (r) => r.gallons },
        { header: "price_per_gallon", value: (r) => r.pricePerGallon },
        { header: "total_cost", value: (r) => r.totalCost },
        { header: "octane", value: (r) => r.octane },
        { header: "station", value: (r) => r.station },
        { header: "partial_fill", value: (r) => r.partialFill },
        { header: "missed_fill", value: (r) => r.missedFill },
        { header: "trip_miles", value: (r) => r.tripMiles },
        { header: "trip_mpg", value: (r) => r.tripMpg },
        { header: "notes", value: (r) => r.notes },
      ];
      return toCsv(rows, cols);
    }

    case "service": {
      const rows = await prisma.serviceEntry.findMany({
        where: { vehicleId },
        orderBy: { performedAt: "asc" },
      });
      const cols: CsvColumn<(typeof rows)[number]>[] = [
        { header: "performed_at", value: (r) => r.performedAt },
        { header: "odometer", value: (r) => r.odometer },
        { header: "category", value: (r) => r.category },
        { header: "service_type", value: (r) => r.serviceType },
        { header: "custom_label", value: (r) => r.customLabel },
        { header: "diy", value: (r) => r.diy },
        { header: "shop_name", value: (r) => r.shopName },
        { header: "parts_cost", value: (r) => r.partsCost },
        { header: "labor_cost", value: (r) => r.laborCost },
        { header: "total_cost", value: (r) => r.totalCost },
        { header: "part_brand", value: (r) => r.partBrand },
        { header: "part_number", value: (r) => r.partNumber },
        { header: "part_condition", value: (r) => r.partCondition },
        { header: "supplier", value: (r) => r.supplier },
        { header: "warranty_months", value: (r) => r.warrantyMonths },
        { header: "warranty_miles", value: (r) => r.warrantyMiles },
        { header: "oil_type", value: (r) => r.oilType },
        { header: "oil_viscosity", value: (r) => r.oilViscosity },
        { header: "oil_filter_part", value: (r) => r.oilFilterPart },
        { header: "symptoms", value: (r) => r.symptoms },
        { header: "diagnosis", value: (r) => r.diagnosis },
        { header: "resolved_issue_id", value: (r) => r.resolvedIssueId },
        { header: "notes", value: (r) => r.notes },
      ];
      return toCsv(rows, cols);
    }

    case "tires": {
      const rows = await prisma.tireSet.findMany({
        where: { vehicleId },
        orderBy: { installedAt: "asc" },
      });
      const cols: CsvColumn<(typeof rows)[number]>[] = [
        { header: "brand", value: (r) => r.brand },
        { header: "model", value: (r) => r.model },
        { header: "size", value: (r) => r.size },
        { header: "load_index", value: (r) => r.loadIndex },
        { header: "speed_rating", value: (r) => r.speedRating },
        { header: "treadwear", value: (r) => r.treadwear },
        { header: "installed_at", value: (r) => r.installedAt },
        { header: "install_mileage", value: (r) => r.installMileage },
        { header: "removed_at", value: (r) => r.removedAt },
        { header: "remove_mileage", value: (r) => r.removeMileage },
        { header: "remove_reason", value: (r) => r.removeReason },
        { header: "cost", value: (r) => r.cost },
        { header: "notes", value: (r) => r.notes },
      ];
      return toCsv(rows, cols);
    }

    case "reminders": {
      const rows = await prisma.reminder.findMany({
        where: { vehicleId },
        orderBy: { label: "asc" },
      });
      const cols: CsvColumn<(typeof rows)[number]>[] = [
        { header: "label", value: (r) => r.label },
        { header: "service_type", value: (r) => r.serviceType },
        { header: "interval_miles", value: (r) => r.intervalMiles },
        { header: "interval_months", value: (r) => r.intervalMonths },
        { header: "last_done_miles", value: (r) => r.lastDoneMiles },
        { header: "last_done_at", value: (r) => r.lastDoneAt },
        { header: "is_active", value: (r) => r.isActive },
        { header: "notes", value: (r) => r.notes },
      ];
      return toCsv(rows, cols);
    }

    case "issues": {
      const rows = await prisma.issue.findMany({
        where: { vehicleId },
        orderBy: { reportedAt: "asc" },
      });
      const cols: CsvColumn<(typeof rows)[number]>[] = [
        { header: "reported_at", value: (r) => r.reportedAt },
        { header: "reported_mileage", value: (r) => r.reportedMileage },
        { header: "status", value: (r) => r.status },
        { header: "symptom", value: (r) => r.symptom },
        { header: "diagnosis", value: (r) => r.diagnosis },
        { header: "dtc_codes", value: (r) => r.dtcCodes },
        { header: "resolved_at", value: (r) => r.resolvedAt },
        {
          header: "resolved_service_entry_id",
          value: (r) => r.resolvedServiceEntryId,
        },
        { header: "notes", value: (r) => r.notes },
      ];
      return toCsv(rows, cols);
    }

    case "odometer": {
      const rows = await prisma.odometerReading.findMany({
        where: { vehicleId },
        orderBy: { recordedAt: "asc" },
      });
      const cols: CsvColumn<(typeof rows)[number]>[] = [
        { header: "recorded_at", value: (r) => r.recordedAt },
        { header: "miles", value: (r) => r.miles },
        { header: "source", value: (r) => r.source },
        { header: "source_id", value: (r) => r.sourceId },
      ];
      return toCsv(rows, cols);
    }
  }
}
