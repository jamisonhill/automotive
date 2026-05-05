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

## Phase 4: Maintenance + Repairs [PENDING]
- [ ] Unified ServiceEntry log (routine + repair + inspection + modification)
- [ ] Component history view (per-component replacement timeline)
- [ ] Warranty tracking dashboard
- [ ] Issue / DTC log

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
