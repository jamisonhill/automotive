import { FileText, Receipt as ReceiptIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { serviceLabel } from "@/lib/service-types";

/*
 * Receipts gallery — every service entry on the vehicle that has a
 * receipt file attached, rendered as a 2-column visual grid.
 *
 * Each card has two interactive zones:
 *   1. The thumbnail itself — opens the original file in a new tab via
 *      the existing /api/receipts/[file] handler. Anchor (not Link) so
 *      target="_blank" + Safari saves work as expected.
 *   2. The card body row — links to the entry's edit page. Two sibling
 *      anchors inside one Card; no nested anchors.
 *
 * PDFs render with a generic FileText icon since browsers can't inline
 * a PDF preview cheaply on mobile.
 */
export default async function ReceiptsGalleryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, userId, isActive: true },
    select: { id: true, year: true, make: true, model: true, nickname: true },
  });
  if (!vehicle) notFound();

  // Only entries with a receipt — null receiptPath would crash the
  // image src and adds nothing to the gallery.
  const entries = await prisma.serviceEntry.findMany({
    where: { vehicleId: id, receiptPath: { not: null } },
    orderBy: { performedAt: "desc" },
    select: {
      id: true,
      performedAt: true,
      serviceType: true,
      customLabel: true,
      totalCost: true,
      receiptPath: true,
    },
  });

  return (
    <main className="mx-auto max-w-md px-4 py-4">
      <PageHeader
        title="Receipts"
        subtitle={
          vehicle.nickname ?? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        }
        backHref={`/vehicles/${vehicle.id}/service`}
      />

      {entries.length === 0 ? (
        <Card className="py-10 text-center">
          <ReceiptIcon className="mx-auto mb-3 h-8 w-8 text-fg-muted" />
          <p className="text-fg-secondary">
            No receipts uploaded yet. Add one when logging a service
            entry.
          </p>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-xs text-fg-muted">
            {entries.length} receipt{entries.length === 1 ? "" : "s"} ·
            tap a thumbnail to open the original.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {entries.map((e) => {
              const filename = e.receiptPath as string;
              const isPdf = filename.toLowerCase().endsWith(".pdf");
              const fileUrl = `/api/receipts/${filename}`;
              const editHref = `/vehicles/${vehicle.id}/service/${e.id}/edit`;
              const label = serviceLabel(e.serviceType, e.customLabel);

              return (
                <Card key={e.id} className="overflow-hidden p-0">
                  {/* Thumbnail — opens original in a new tab. PDFs get
                      a generic icon since we can't preview them inline. */}
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-square w-full bg-bg-overlay active:opacity-80"
                  >
                    {isPdf ? (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-fg-muted">
                        <FileText className="h-8 w-8" />
                        <span className="text-[10px] uppercase tracking-wider">
                          PDF
                        </span>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={fileUrl}
                        alt={`Receipt for ${label}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </a>

                  {/* Body — links to the entry edit page. Sibling
                      anchor; not nested with the thumbnail link. */}
                  <Link
                    href={editHref}
                    className="block border-t border-border-subtle p-2 active:bg-bg-overlay"
                  >
                    <p className="truncate text-xs font-semibold text-fg-primary">
                      {label}
                    </p>
                    <p className="mt-0.5 flex items-baseline justify-between text-[11px] text-fg-muted">
                      <span>
                        {e.performedAt.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "2-digit",
                        })}
                      </span>
                      {e.totalCost != null && (
                        <span className="tabular-nums">
                          ${e.totalCost.toFixed(0)}
                        </span>
                      )}
                    </p>
                  </Link>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
