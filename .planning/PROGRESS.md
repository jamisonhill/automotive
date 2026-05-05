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

## Phase 4: Maintenance + Repairs [IN PROGRESS]

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

### 4c: Issue / DTC log [PENDING — RESUME HERE]
- [ ] `issueSchema` in validators (status enum, dtcCodes parsing)
- [ ] Server actions: createIssue, updateIssue, resolveIssue, deleteIssue
- [ ] Issue form client component (symptom, DTC codes, status, notes)
- [ ] Issue list page (`/vehicles/[id]/issues`) — filters by status
- [ ] Add/edit pages
- [ ] Link from a service entry → resolved issue (close the loop)
- [ ] Vehicle dashboard "Issues & DTCs" tile enabled with open count

### 4b: Service form polish [PENDING]
- [ ] Apply `defaultWarrantyMonths` from catalog as a placeholder/default
- [ ] Tighter conditional sections (e.g., warranty only for repairs)
- [ ] Parts info presets per serviceType (oil filter PN suggestions, etc.)
- [ ] Better visual hierarchy on long form

### 4d: Component history view [PENDING]
- [ ] `/vehicles/[id]/service/types/[serviceType]` — every entry of one
      type, ordered chronologically, with miles-between-replacements stat
- [ ] Linked from each entry's service-type label

### 4e: Warranty tracking dashboard [PENDING]
- [ ] `/vehicles/[id]/warranties` — active warranties with months-left
      and miles-left countdown
- [ ] "Expiring soon" surface on vehicle dashboard

## Phase 5: Tires [PENDING]
- [ ] TireSet CRUD
- [ ] Rotation log
- [ ] Per-corner pressure log
- [ ] Tread depth tracking with replacement projection

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
