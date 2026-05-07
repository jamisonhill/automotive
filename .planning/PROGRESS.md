# Automotive — Progress

Personal car maintenance + metrics web app. Multi-vehicle, iPhone-first, dark only,
deployed on home NAS via Cloudflare Tunnel + Access (Face ID).

## Phase 1: Foundation [DONE]
- [x] Next.js 16 + Tailwind v4 scaffold, dark theme
- [x] Prisma schema (Vehicle, Baseline, OdometerReading, FuelEntry, ServiceEntry,
      TireSet, TirePressureLog, TreadDepthLog, Reminder, Issue)
- [x] Cloudflare Access JWT verification at the edge (`src/proxy.ts`)
- [x] Multi-stage Dockerfile + standalone runtime
- [x] GitHub Actions → ghcr.io publish workflow
- [x] docker-compose stack with cloudflared + Watchtower
- [x] Cloudflare setup guide (`docs/cloudflare-setup.md`)
- [x] NAS deploy guide (`docs/nas-deploy.md`)
- [x] UI primitives (Button, Card, Input, Label)

Commit: `1151252` — Phase 1: foundation — scaffold, schema, auth, deploy pipeline

## Phase 2: Vehicles + Baseline [DONE]
- [x] Garage home page (vehicle picker)
- [x] Vehicle add/edit form with photo upload
- [x] Vehicle detail dashboard shell with section tiles
- [x] Used-car baseline intake form (tires, brakes, battery, fluids, belts/hoses, notes)
- [x] Photo upload pipeline (`/api/photos/[file]`, content-hashed filenames)
- [x] Server actions for vehicle CRUD + baseline upsert
- [x] Form primitives (Select, Textarea, Field, Section, PageHeader)
- [x] Initial Prisma migration

Commit: `a1d9536` — Phase 2: vehicles + used-car baseline

## Phase 3: Odometer + Fuel [DONE]
- [x] Anthropic SDK + Claude Haiku 4.5 vision OCR helper (`src/lib/ocr.ts`)
- [x] MPG + cost-per-mile calculation logic with partial/missed-fill handling
      (`src/lib/fuel.ts`)
- [x] Server actions: createFuelEntry, updateFuelEntry, deleteFuelEntry,
      extractPumpData (OCR), logOdometer (`src/app/actions/fuel.ts`)
- [x] Fuel form (client component) — auto-derive cost fields, snap-pump button,
      client-side image resize, OCR call (`src/components/fuel-form.tsx`)
- [x] SVG sparkline component (`src/components/sparkline.tsx`)
- [x] Fuel list page with stats grid + sparkline (`/vehicles/[id]/fuel`)
- [x] Add fill-up page (`/vehicles/[id]/fuel/new`)
- [x] Edit/delete fill-up page (`/vehicles/[id]/fuel/[entryId]/edit`)
- [x] Vehicle dashboard tile updated to link to fuel + show last MPG
- [x] OCR verified end-to-end on iPhone Safari with real pump photos.
      Tested at a Sheetz pump: gallons + total + station all extracted.
- [x] Auto-set "When" timestamp on photo accept; default octane = 87;
      derive $/gallon from total÷gallons when out of frame.
- [x] Build + typecheck clean

### iPhone gotchas resolved during Phase 3
- Next.js 16 blocks LAN-origin dev resources by default; required
  `allowedDevOrigins: ["192.168.0.16"]` in `next.config.ts` so the iPhone
  could fetch the client JS bundle and hydrate.
- iOS Safari does not fire `change` on `<input type="file" capture="…">`
  when the input is inside a `<form>`. Worked around by lifting the
  input outside the form and linking via `<label htmlFor>`.
- `new Date()` at component-render time produces SSR/client mismatch
  that aborts hydration. Datetime field is now seeded server-stable and
  set to "now" only after the user accepts a photo (or manually).

## Phase 4: Maintenance + Repairs [DONE]

Broken into five sub-phases. Order of attack: 4a → 4c → 4b → 4d → 4e.

### 4a: ServiceEntry CRUD + receipts [DONE]
- [x] Curated service-type catalog (`src/lib/service-types.ts`) — ~40 entries
      grouped by category (routine/repair/inspection/modification/diagnostic)
      with `defaultWarrantyMonths` hints on common parts. Includes `custom`
      escape hatch with required customLabel.
- [x] `serviceSchema` in `src/lib/validators.ts` (superRefine enforces
      customLabel when serviceType==='custom').
- [x] Receipt upload helper (`src/lib/receipts.ts`) — accepts JPEG/PNG/WebP/
      HEIC/PDF, content-hashed filenames under `DATA_DIR/receipts`.
- [x] `/api/receipts/[file]` route handler (mirrors `/api/photos`).
- [x] Server actions: createServiceEntry, updateServiceEntry,
      deleteServiceEntry (`src/app/actions/service.ts`). Each write mirrors
      to OdometerReading. Receipt replace/remove semantics on update.
- [x] Service form client component (`src/components/service-form.tsx`):
      service-type picker (optgroup'd + Custom), category sync, cost split
      with auto-derive (parts+labor=total), DIY toggle, parts/warranty,
      oil-change-specific fields, repair narrative, receipt upload+preview.
      Hydration-safe.
- [x] List page with year-grouping + stats (`/vehicles/[id]/service`).
- [x] Add page with odometer pre-fill (`/vehicles/[id]/service/new`).
- [x] Edit/delete page (`/vehicles/[id]/service/[entryId]/edit`).
- [x] `getVehicle` includes most-recent serviceEntry; vehicle dashboard
      Service tile enabled with last-service date.
- [x] Verified end-to-end on iPhone (catalog + custom, DIY + shop, oil
      change preset, repair narrative, receipt upload).

Commit: `0327078` — Phase 4a: ServiceEntry CRUD + receipts

### 4c: Issue / DTC log [DONE]
- [x] `issueSchema` in validators (status enum, dtcCodes parsing)
- [x] Server actions: createIssue, updateIssue, deleteIssue (with
      bidirectional ServiceEntry.resolvedIssueId sync)
- [x] Issue form client component (symptom, DTC codes, status, notes,
      conditional resolution section, hydration-safe)
- [x] Issue list page (`/vehicles/[id]/issues`) with All / Open /
      Monitoring / Resolved filter chips
- [x] Add/edit pages
- [x] Service entry link picker (resolution → service entry)
- [x] Vehicle dashboard "Issues & DTCs" tile enabled with open count
      badge

Commit: `b6a90f5` — Phase 4c: issues / DTC log

### 4b: Service form polish [DONE]
- [x] `defaultWarrantyMonths` auto-applies from catalog when warranty
      field is empty; placeholder shows the default
- [x] Warranty section: repair only (was: every category)
- [x] Part info: inline for repair / modification / oil change;
      collapsed `<details>` for routine; hidden for inspection +
      diagnostic
- [x] Brand suggestions via `<datalist>` populated from a
      BRAND_SUGGESTIONS map (~25 service types, 4–6 brands each)
- [x] Extracted PartInfoFields helper to keep inline + collapsed in
      sync

Commit: `877a018` — Phase 4b: service form polish

### 4d: Component history view [DONE]
- [x] `/vehicles/[id]/service/types/[serviceType]` — every entry of one
      type, with miles + days deltas between occurrences and aggregate
      stats (count, total spent, avg miles between, avg time between)
- [x] Service-type label on the service log links to the history page
      (with a small History icon). Custom entries excluded — each
      customLabel may refer to a different thing.
- [x] Two sibling links inside one Card: title row → history; body
      row → edit. No nested anchors.

Commit: `f2288b4` — Phase 4d: component history view

### 4e: Warranty tracking dashboard [DONE]
- [x] `src/lib/warranties.ts` — computeWarrantyStatus +
      EXPIRING_DAYS_LEFT (90) / EXPIRING_MILES_LEFT (2000) thresholds
- [x] `/vehicles/[id]/warranties` — Active / Expiring soon / Expired
      filter chips (default = Active), per-warranty cards with two-up
      countdown tiles (time + miles)
- [x] Sort within each filter = earliest expiration first
- [x] getVehicle returns warrantySummary {active, expiring, expired}
- [x] Dashboard "Warranties" tile (ShieldCheck) — turns warning-orange
      with count badge when there's anything expiring soon, deep-jumps
      to ?filter=expiring

Commit: `5cfc50a` — Phase 4e: warranty tracking dashboard

## Phase 5: Tires [IN PROGRESS]

Sub-phased: 5a → 5b → 5c.

### 5a: TireSet CRUD + dashboard tile [DONE]
- [x] `tireSetSchema` (create/edit) + `tireSetRemovalSchema` in
      validators. closePreviousSet toggle for replacing-current flow.
- [x] Server actions in `src/app/actions/tires.ts`:
      createTireSet (auto-closes prev active when toggle is on,
      mirrors install to OdometerReading),
      updateTireSet (keeps install-time odometer reading in sync),
      removeTireSet (stamps removedAt + removeMileage + reason,
      appends `[Removed]` note, mirrors a tire_remove odometer reading),
      deleteTireSet (drops linked odometer rows; pressure/tread cascade
      via schema)
- [x] `tire-set-form.tsx` (TireSetForm + TireSetRemovalForm)
- [x] Pages: `/vehicles/[id]/tires` (Current + Other active +
      History), `/tires/new`, `/tires/[setId]/edit` (edit + conditional
      remove + delete)
- [x] getVehicle includes `tireSets` filtered to active set
- [x] Vehicle dashboard "Tires" tile is live, shows brand/model/size
      of current set or empty-state copy

Commit: `4418b60` — Phase 5a: TireSet CRUD + dashboard tile

### 5b: Per-corner pressure log [DONE]
- [x] `pressureLogSchema` in validators — recordedAt, ambientF, all
      8 PSI fields (FL/FR/RL/RR × Before/After), tireSetId optional.
      superRefine enforces ≥1 Before PSI value.
- [x] Server actions: createPressureLog, updatePressureLog,
      deletePressureLog (`src/app/actions/tire-pressures.ts`).
      Auto-binds tireSetId to active set when picker is blank;
      cross-vehicle defense on explicit picks.
- [x] Pressure form client component — 4-corner 2x2 grid mirroring
      the car looking down. "I added air" toggle gates the After
      column. Hydration-safe (no `new Date()` at render).
- [x] Pressure list page (`/vehicles/[id]/tires/pressures`) — latest
      log rendered as hero card with full 4-corner grid + before→after
      deltas (green = added air, amber = leak/change). Older logs as
      compact rows showing F-avg / R-avg.
- [x] Add / edit pages. Edit page surfaces removed-but-linked sets in
      the picker so historical links don't disappear.
- [x] Surface latest log on the Tires Current set card. "Checked X
      ago · F 32/32 · R 30/30" or empty-state CTA. Two sibling links
      inside one Card (no nested anchors).
- [x] Build + typecheck clean
- [x] Verified end-to-end on iPhone

### 5c: Tread depth log + replacement projection [PENDING — RESUME HERE]
- [ ] `treadDepthLogSchema` in validators — recordedAt, mileage,
      4 corners (32nds), notes
- [ ] Server actions: createTreadDepthLog, updateTreadDepthLog,
      deleteTreadDepthLog
- [ ] Tread form client component — 4-corner grid in 32nds with
      visual hint (full = 10/32, replace at 2/32)
- [ ] Tread list/timeline page (`/vehicles/[id]/tires/[setId]/tread`)
- [ ] Replacement projection: linear regression of min-corner depth vs
      mileage → estimated mileage at 2/32 ("approximately X mi to go")
- [ ] Surface projection on the Tires Current set card

## Phase 6: Reminders [PENDING]
- [ ] Interval-based reminder engine
- [ ] "Due soon" dashboard widget
- [ ] Manufacturer default intervals seeded per vehicle

## Phase 7: Analytics [PENDING]
- [ ] Cost-per-mile, MPG trends, year-over-year
- [ ] Total cost of ownership

## Phase 8: Polish [PENDING]
- [ ] PWA install (manifest, icons)
- [ ] CSV export
- [ ] Receipt photo gallery

## Deploy state
- Local dev only so far. Not yet pushed to GitHub. NAS Portainer stack not yet
  deployed. Cloudflare Tunnel + Access not yet configured.
- All deploy infra is written and ready in the repo (Dockerfile, GH Actions,
  docker-compose.yml, docs/cloudflare-setup.md, docs/nas-deploy.md).
