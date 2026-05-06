# Resume — Automotive

**Paused:** 2026-05-05 (evening)
**Reason:** Phase 5a (TireSet CRUD + dashboard tile) committed and
verified end-to-end on iPhone. Clean stopping point before Phase 5b.
**Phase:** 5 / 8 (sub-phase 5a done; 5b next)
**Last commit:** `4418b60` — Phase 5a: TireSet CRUD + dashboard tile

## Where we are

Phase 4 (Maintenance + Repairs) is fully shipped — all five sub-phases
(4a, 4b, 4c, 4d, 4e) are committed and tested on iPhone. The vehicle
dashboard now has live tiles for Baseline, Fuel, Service, Warranties,
Issues & DTCs, and Tires.

Phase 5 (Tires) is broken into three sub-phases. The agreed order:
5a → 5b → 5c. **5a is complete and shipped** — the user can install,
edit, mark-removed, and delete tire sets, with auto-close of the
previous active set on a fresh install.

## Resume action: start Phase 5b (Per-corner pressure log)

The `TirePressureLog` model already exists in `prisma/schema.prisma`:

```prisma
model TirePressureLog {
  id         String   @id @default(cuid())
  vehicleId  String
  vehicle    Vehicle  @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  tireSetId  String?
  tireSet    TireSet? @relation(fields: [tireSetId], references: [id])
  recordedAt DateTime
  ambientF   Float?

  // Before-fill PSI per corner
  flBefore Float?
  frBefore Float?
  rlBefore Float?
  rrBefore Float?

  // After-fill PSI per corner (null if it was a check-only event)
  flAfter Float?
  frAfter Float?
  rlAfter Float?
  rrAfter Float?

  notes String?

  @@index([vehicleId, recordedAt])
}
```

`tireSetId` is nullable on purpose — the user might log pressures
without remembering to associate to a set, or before they've added a
set. We default to the active set when present.

### Concrete plan for 5b

Mirror the established pattern (Phase 4a/4c, Phase 5a):

1. **`pressureLogSchema`** in `src/lib/validators.ts`
   - Required: recordedAt, vehicleId-bound, at least one PSI value
   - Optional: tireSetId, ambientF, all 8 PSI fields independently
   - Validation: superRefine to require at least one Before PSI value
     (otherwise the row carries no information)

2. **`src/app/actions/tire-pressures.ts`** (new file)
   - `createPressureLog(vehicleId, formData)` — auto-bind to active
     tireSet if user didn't pick one; preserve null tireSetId only when
     there is no active set
   - `updatePressureLog(vehicleId, logId, formData)`
   - `deletePressureLog(vehicleId, logId)`

3. **`src/components/pressure-log-form.tsx`** — client component
   - 4-corner grid (FL, FR / RL, RR) — before column always visible
   - "After fill" toggle: when off, hide After column entirely (it's a
     check-only event)
   - Ambient temperature field (°F)
   - Hidden tireSetId picked from the active set, exposed as Select if
     the user wants to attach to a different set (e.g. snows in winter)
   - Hydration-safe: same `seededRecordedAt` pattern as fuel/service/
     issue forms (no `new Date()` at render)

4. **Pages**
   - `/vehicles/[id]/tires/pressures` — list. Most-recent log up top
     showing all 4 corners with delta (before → after), older logs
     below in compact rows
   - `/vehicles/[id]/tires/pressures/new`
   - `/vehicles/[id]/tires/pressures/[logId]/edit`

5. **Surface on Tires Current-set card**
   - "Last checked: 3 days ago · F 32/32 · R 30/30" or similar
   - Links to `/tires/pressures`

6. **Build + typecheck clean** before the commit

## Files relevant to 5b work

```
prisma/schema.prisma                         — TirePressureLog (already there)
src/lib/validators.ts                        — add pressureLogSchema
src/app/actions/tire-pressures.ts            — NEW
src/components/pressure-log-form.tsx         — NEW
src/app/vehicles/[id]/tires/pressures/page.tsx                       — NEW
src/app/vehicles/[id]/tires/pressures/new/page.tsx                   — NEW
src/app/vehicles/[id]/tires/pressures/[logId]/edit/page.tsx          — NEW
src/app/vehicles/[id]/tires/page.tsx         — surface latest log on Current card
```

## To restart dev

```bash
cd /Users/jamisonhill/Ai/automotive
npm run dev
```

Open `http://localhost:3000` (laptop) or `http://192.168.0.16:3000`
(iPhone). LAN IP is allow-listed in `next.config.ts` already.

## Things to remember when resuming

- **Hydration safety**: never call `new Date()` at component-render
  time. Use a server-stable seed; set "now" in a post-mount handler if
  you need it.
- **Form encType**: don't set `encType` on a `<form>` whose action is a
  server-action function — React handles it. Setting it triggers a
  console warning on iPhone.
- **iPhone form quirks** (file inputs only — irrelevant for 5b):
  `capture="environment"` inputs must live OUTSIDE the `<form>` and
  link via `<label htmlFor>`.
- **Dev server LAN access**: `next.config.ts` has
  `allowedDevOrigins: ["192.168.0.16"]`.
- **Existing Tire UX**: a vehicle has at most one active TireSet most
  of the time, but the schema allows multiple (e.g. seasonal swap).
  The pressure-log default-tireSetId logic should pick the
  most-recently-installed active set. The user can override.

## Sub-phase queue after 5b

- **5c** — Tread depth log with replacement projection (linear
  regression of min-corner tread vs mileage → estimated miles to 2/32)

## Deploy state

Still local-only. Not pushed to GitHub yet (will be after this pause).
NAS Portainer stack not deployed. Cloudflare Tunnel + Access not
configured. All deploy infra written and ready (Dockerfile, GH Actions,
docker-compose.yml, docs).

## Recent commit history

```
4418b60 Phase 5a: TireSet CRUD + dashboard tile
5cfc50a Phase 4e: warranty tracking dashboard
f2288b4 Phase 4d: component history view
877a018 Phase 4b: service form polish
b6a90f5 Phase 4c: issues / DTC log
6f6d652 pause: Phase 4a done, resuming at Phase 4c (Issues / DTC log)
0327078 Phase 4a: ServiceEntry CRUD + receipts
8a07adc Phase 3: fuel + OCR verified end-to-end on iPhone
2986675 pause: Phase 3 fuel + OCR built, awaiting iPhone OCR verification
a1d9536 Phase 2: vehicles + used-car baseline
1151252 Phase 1: foundation — scaffold, schema, auth, deploy pipeline
```
