import { Car, Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listActiveVehicles } from "@/lib/queries";

// Per-user data; never static. Without this, `next build` tries to
// prerender the page in environments without a DATABASE_URL (Docker
// build container, CI), which fails when Prisma initializes.
export const dynamic = "force-dynamic";

/*
 * Garage — the home page and main entry point.
 * Shows every active vehicle as a tappable card. "Add vehicle" CTA below.
 *
 * Server component: fetches directly from Prisma at request time. No useEffect,
 * no client/server boundary to manage. Caching is handled by Next + the
 * revalidatePath() calls in our server actions.
 */
export default async function HomePage() {
  const vehicles = await listActiveVehicles();

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <header className="mb-6 flex items-center gap-3">
        <div className="rounded-md bg-accent p-2">
          <Car className="h-6 w-6 text-accent-fg" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-fg-primary">Garage</h1>
          <p className="text-sm text-fg-secondary">
            {vehicles.length === 0
              ? "No vehicles yet."
              : `${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </header>

      {vehicles.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="mb-4 text-fg-secondary">
            Add your first vehicle to get started.
          </p>
          <Link href="/vehicles/new">
            <Button size="md">
              <Plus className="h-4 w-4" />
              Add vehicle
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => {
            const latestMiles = v.odometerReadings[0]?.miles;
            return (
              <Link
                key={v.id}
                href={`/vehicles/${v.id}`}
                className="block transition-transform active:scale-[0.99]"
              >
                <Card className="flex gap-4 p-3">
                  {/* Photo or placeholder icon — 80x80 square for thumb-friendly tap */}
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-bg-overlay flex items-center justify-center">
                    {v.photoPath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/photos/${v.photoPath}`}
                        alt={`${v.year} ${v.make} ${v.model}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Car className="h-8 w-8 text-fg-muted" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {v.nickname && (
                      <p className="text-sm font-medium text-accent">
                        {v.nickname}
                      </p>
                    )}
                    <p className="font-semibold text-fg-primary truncate">
                      {v.year} {v.make} {v.model}
                    </p>
                    {v.trim && (
                      <p className="text-xs text-fg-secondary truncate">
                        {v.trim}
                      </p>
                    )}
                    {latestMiles != null && (
                      <p className="mt-1 text-xs text-fg-muted">
                        {latestMiles.toLocaleString()} mi
                      </p>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}

          <Link href="/vehicles/new" className="block pt-2">
            <Button variant="secondary" size="lg">
              <Plus className="h-5 w-5" />
              Add vehicle
            </Button>
          </Link>
        </div>
      )}
    </main>
  );
}
