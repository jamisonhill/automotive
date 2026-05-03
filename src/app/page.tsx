import { Car } from "lucide-react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";

/*
 * Home page — vehicle picker.
 * Phase 1: static placeholder confirming the dark theme + layout work end-to-end.
 * Phase 2 will fetch vehicles from the DB and render them as tappable cards
 * leading into per-vehicle dashboards.
 */
export default function HomePage() {
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <header className="mb-8 flex items-center gap-3">
        <div className="rounded-md bg-accent p-2">
          <Car className="h-6 w-6 text-accent-fg" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-fg-primary">Garage</h1>
          <p className="text-sm text-fg-secondary">
            Pick a vehicle to log or view.
          </p>
        </div>
      </header>

      <div className="space-y-3">
        <Card className="text-center py-12">
          <CardTitle className="mb-2">No vehicles yet</CardTitle>
          <CardDescription>
            Phase 2 will add vehicle creation here.
          </CardDescription>
        </Card>
      </div>

      <footer className="mt-12 text-center text-xs text-fg-muted">
        Phase 1 · Foundation
      </footer>
    </main>
  );
}
