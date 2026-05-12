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

## Phase 5: Tires [DONE]

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

### 5c: Tread depth log + replacement projection [DONE]
- [x] `treadDepthLogSchema` in validators — recordedAt, mileage,
      4 corners (0-20 in 32nds, all required), notes
- [x] `src/lib/tread-projection.ts` — OLS linear regression of
      min-corner depth vs mileage. Returns kind: ok | insufficient-data
      | no-wear with projected mileage and miles-remaining.
      treadBand() helper for color coding (good/wearing/replace).
- [x] Server actions: createTreadDepthLog, updateTreadDepthLog,
      deleteTreadDepthLog (`src/app/actions/tread-depth.ts`).
      Mirrors to OdometerReading as `tread_check` for canonical
      timeline. assertSetOwnership() defense on every action.
- [x] Tread form client component — 4-corner 2x2 grid with live
      color-coded badges that update as you type (Good/Wearing/Replace).
      type="number" + min=0 max=20 so typos are blocked client-side
      with a friendly tooltip instead of a server ZodError page.
      Hydration-safe.
- [x] Tread list/timeline page (`/vehicles/[id]/tires/[setId]/tread`)
      — projection hero ("Replace in ~12k mi · low confidence" or
      "past replacement" in red), latest reading card with color-coded
      corners, history rows.
- [x] Add / edit pages. Mileage pre-fills from latest odometer on
      create.
- [x] Surface tread on Tires Current set card. "Tread 8/32 · ~12k mi
      to replace" or empty-state CTA. Three stacked sibling links
      inside one Card (no nested anchors): edit / tread / pressure.
- [x] Build + typecheck clean
- [x] Verified end-to-end on iPhone (including the typo-bounds fix)

## Phase 6: Reminders [DONE]

Sub-phased: 6a → 6b → 6c.

### 6a: Reminder CRUD + status engine [DONE]
- [x] `reminderSchema` in validators — label required, serviceType
      optional, intervalMiles/Months with ≥1 required (superRefine),
      optional manual lastDoneMiles/lastDoneAt, isActive default true,
      notes
- [x] `src/lib/reminders.ts` — computeReminderStatus returning
      kind: overdue | due_soon | ok | no_data with miles/days remaining.
      resolveLastDone() merges explicit overrides with matching
      ServiceEntry rows (forward-only). DUE_SOON_MILES=500,
      DUE_SOON_DAYS=30. urgencySortKey() for most-urgent-first ordering.
- [x] Server actions: createReminder, updateReminder, deleteReminder
      (`src/app/actions/reminders.ts`). Cross-vehicle ownership defense.
- [x] Reminder form client component — service-type optgroup picker
      that auto-fills label when blank; mileage/months inputs use
      HTML5 type="number" with min=0; isActive checkbox uses
      hidden-field-first trick so unchecked submits as false (the
      formDataToObject helper takes the LAST value for a given name,
      so the hidden "off" must come BEFORE the checkbox).
      Hydration-safe.
- [x] Pages: list (active sorted by urgency, overdue/due-soon count
      pills, paused section), new, edit (with delete button).
- [x] Reminders tile enabled on vehicle dashboard — basic for now;
      count badge + warning color come in 6c.
- [x] Build + typecheck clean
- [x] Verified end-to-end on iPhone

Commit: `3835212` — Phase 6a: reminder CRUD + status engine

### 6b: ServiceEntry auto-advance [DONE]
- [x] `src/lib/reminder-advance.ts` — advanceMatchingReminders helper
      uses two updateMany calls with forward-only filters (one per
      dimension). Skips serviceType "custom" since it never matches.
- [x] `createServiceEntry` + `updateServiceEntry` call the helper
      after the DB write and revalidate `/vehicles/[id]/reminders`.
- [x] `deleteServiceEntry` deliberately does NOT roll back; rare and
      would require a full history rescan. Documented in the update
      action's comment.
- [x] Service form switched performedAt input from `datetime-local`
      to `date` (no time picker). New-page seeds defaults.performedAt
      to `new Date()` from the server component so today is pre-
      filled in a hydration-safe way.
- [x] Build + typecheck clean
- [x] Verified end-to-end on iPhone

Commit: `360ed08` — Phase 6b: ServiceEntry → Reminder auto-advance + date-only service form

### 6c: Dashboard surface + common-reminders seed [DONE]
- [x] `getVehicle` returns `reminderSummary { active, dueSoon,
      overdue }`. Computes live status using the same engine as the
      reminders page so the tile and the list never disagree.
- [x] Vehicle dashboard "Reminders" tile turns warning-orange with
      a count badge of (overdue + dueSoon) when alertable. Mirrors
      the Warranties tile pattern.
- [x] `seedCommonReminders` server action seeds 7 typical defaults
      (oil change, tire rotation, engine + cabin air filters, brake
      fluid flush, state inspection, wiper blades). Idempotent:
      skips serviceTypes already present so re-clicking never dupes.
- [x] Reminders empty-state shows a secondary "Add common reminders"
      ghost button alongside the primary "Add reminder" CTA.
- [x] Build + typecheck clean
- [x] Verified end-to-end on iPhone

Commit: `02c3455` — Phase 6c: dashboard reminders tile + common-reminders seed

## Phase 7: Analytics [DONE]

Sub-phased: 7a → 7b.

### 7a: Lifetime numbers + TCO [DONE]
- [x] `src/lib/analytics.ts` — computeLifetimeMiles + summarizeAnalytics.
      Single denominator (lifetime miles) so per-category $/mi sums to
      the headline. Lifetime miles = max(odometer) - min(odometer),
      preferring purchaseMileage as the floor when set.
- [x] `/vehicles/[id]/analytics` — server component with hero stats
      (lifetime miles + total $/mi), operating cost table (fuel /
      service / tires + total with per-mile column), and TCO card
      (rendered only when purchasePrice is recorded; includes
      years-owned + $/year footer).
- [x] Vehicle dashboard gains an Analytics tile (TrendingUp icon).
- [x] Build + typecheck clean
- [x] Verified end-to-end on iPhone

Commit: `ddc5abc` — Phase 7a: per-vehicle analytics — lifetime numbers + TCO

### 7b: Trends — MPG sparkline + YoY [DONE]
- [x] `summarizeYearOverYear` groups fuel/service/tire spend by
      calendar year, computes per-year miles driven from odometer
      span when ≥ 2 readings landed in the year, emits per-year $/mi.
      Sorts newest-first; years with no activity are omitted.
- [x] MPG trend Sparkline on the analytics page — only valid full
      fills contribute, x-axis is filledAt epoch so points space by
      real elapsed time. Footer shows date range + lifetime $/mi fuel.
- [x] Year-over-year table — mobile-optimized: drops the Tires column
      when no year had tire spend, $/mi as a small sub-line under
      each year's total. Hidden when only one year of activity exists.
- [x] Build + typecheck clean
- [x] Verified end-to-end on iPhone

Commit: `6c112e6` — Phase 7b: analytics trends — MPG sparkline + year-over-year table

## Phase 8: Polish [DONE]

Sub-phased: 8a → 8b → 8c.

### 8a: PWA install (manifest + icons) [DONE]
- [x] `scripts/generate-icons.mjs` — one-shot icon generator using
      sharp. Renders an inline SVG (Lucide Car silhouette on accent
      blue) into 192/512/180/maskable PNGs. Re-run only when the
      design changes.
- [x] `public/icons/` ships the generated PNGs (~1-3 KB each) so iOS
      gets a proper home-screen icon and Android gets adaptive-icon
      support.
- [x] `src/app/manifest.ts` exposes /manifest.webmanifest via Next's
      metadata-route convention. Standalone display, portrait, black
      theme + background, both `any` and `maskable` icon purposes.
- [x] `layout.tsx` wires icons.icon (favicon) + icons.apple (iOS).
      The appleWebApp config from Phase 1 already covered status-bar.
- [x] Build + typecheck clean
- [x] Verified end-to-end on iPhone (Add to Home Screen → blue car
      icon, full-bleed launch)

Commit: `7dc78eb` — Phase 8a: PWA manifest + home-screen icons

### 8b: CSV export [DONE]
- [x] `src/lib/csv.ts` — RFC 4180 builder. Quotes any cell with comma
      / quote / newline, doubles embedded quotes, ISO 8601 for Dates,
      true/false for booleans, blank for null/NaN, CRLF separator.
- [x] `/api/export/{vehicleId}/{dataset}` — single GET route handler
      dispatching across fuel, service, tires, reminders, issues,
      odometer. Allowlist validation before any DB call. Response
      sets text/csv + Content-Disposition with a useful filename
      (`automotive-{slug}-{dataset}-{date}.csv`).
- [x] `/vehicles/[id]/export` — list of datasets with row counts.
      Each row is a plain `<a download>` to the export route so the
      browser saves rather than navigates.
- [x] Vehicle dashboard gains an Export data tile (Download icon).
- [x] Build + typecheck clean
- [x] Verified end-to-end on iPhone

Commit: `a51fb51` — Phase 8b: CSV export per vehicle

### 8c: Receipt photo gallery [DONE]
- [x] `/vehicles/[id]/receipts` — 2-column grid of every service
      entry with a receipt attached, newest first. Each card has two
      sibling links (no nested anchors): thumbnail opens the original
      file in a new tab via `/api/receipts/[file]`, body row jumps to
      the entry's edit page.
- [x] PDFs render with a FileText icon placeholder; tapping still
      opens the file.
- [x] Service log header gains a ghost Receipt button next to the
      existing Add CTA so the gallery lives in the context where
      receipts are uploaded (no new dashboard tile).
- [x] Build + typecheck clean
- [x] Verified end-to-end on iPhone

Commit: `c2476c2` — Phase 8c: receipt photo gallery

## Phase 9: Multi-tenant auth [DONE]

Cloudflare Access ripped out and replaced with in-app email/password
auth so friends can each have a private garage. Full sub-phase plan
in `.planning/PHASE-9-AUTH.md`.

### 9a–9d.4 [DONE]
- 9a: User model + auth server actions + session helpers (`4e2f532`)
- 9b: /login + /signup pages (`962701a`)
- 9c: Middleware swap CF Access → session cookie (`87bc8cd`)
- 9d.1 + 9d.4: nullable userId + scope every vehicle query (`285f344`)
- 9d.2 prod backfill: complete (1 vehicle assigned to owner)
- Partial 9f (bundled into the cutover): docker-compose.yml drops
  DISABLE_AUTH + CF_ACCESS_*, adds SESSION_SECRET (`370734c`)

### 9e [DONE — `516d498`]
- /account page with email + signed-in date + Sign out button
- CircleUser icon top-right on the Garage root page links to /account

### 9d.3 + 9f [DONE]
- Vehicle.userId migrated nullable → required after prod backfill verified
- docs/cloudflare-setup.md marked deprecated (the Tunnel half is still
  accurate; only the Access half is dead code)
- Stale `Automotive` Cloudflare Access app (if any) safe to delete from
  Zero Trust dashboard

## Deploy

Sub-phased: D1 (LAN-only) → D2 (full prod with Cloudflare Tunnel + Access).

### D1: LAN deploy on home NAS [DONE]
- [x] Pushed `main` to GitHub (was 11 commits ahead). GitHub Actions
      builds and publishes `ghcr.io/jamisonhill/automotive:latest` on
      every push. First successful image: digest `sha256:055cf1d…` at
      commit `d2e4da0`.
- [x] Fixed CI build failure: `/page.tsx` was being statically
      prerendered, which crashed in the Docker build container without
      a DATABASE_URL. Marked the route `force-dynamic`.
- [x] docker-compose.yml prepped: pinned image to `jamisonhill`,
      namespaced cloudflared/watchtower containers (`*-automotive`)
      so they coexist with the existing `cloudflare` and
      `watchtower-devotional` containers on the NAS.
- [x] Refactored compose to LAN-deploy by default: exposed port 3022
      on host, moved cloudflared into a `tunnel` Compose profile,
      defaulted DISABLE_AUTH=true, made all CF + Anthropic env vars
      optional via `${VAR:-default}` substitution.
- [x] Made GHCR package public so Watchtower can pull without a PAT.
- [x] Generated fine-grained PAT and created Portainer stack
      `automotive` via Repository method (compose pulled from GitHub).
- [x] Created `/volume1/docker/automotive/data` on the NAS, chowned to
      uid 1001 (matches the Dockerfile `nextjs` user).
- [x] Initialized SQLite DB inside the running container with
      `npx prisma@6 db push --schema=/app/prisma/schema.prisma` (had
      to pin to v6 because the runtime image has no Prisma CLI and
      `npx prisma` fetched 7.x, which dropped `url` from schema.prisma).
- [x] Verified LAN: `http://192.168.0.9:3022` returns 200 OK; user
      confirmed iPhone access works.

Commits:
- `d2e4da0` — fix: mark / as dynamic so Docker build doesn't prerender Prisma calls
- `1270c27` — deploy: pin GitHub username + namespace cloudflared/watchtower containers
- `31643e0` — deploy: LAN-only by default, tunnel as opt-in profile

### D2: Full prod (Cloudflare Tunnel + Access + OCR) [PENDING — RESUME HERE]
- [ ] **User work — Cloudflare Tunnel** (Zero Trust dashboard):
      Create tunnel `home-nas-automotive` (or reuse). Public hostname:
      subdomain `garage`, domain `duski.org`, type HTTP, URL
      `automotive:3000`. Copy the long string after `--token` →
      `TUNNEL_TOKEN`.
- [ ] **User work — Cloudflare Access app** (Zero Trust →
      Applications): Self-hosted, name `Automotive`, session 1 month,
      domain `garage.duski.org`. Policy: Allow → Include → Emails →
      `jhill@mercyhillchurch.com`. After creation, copy the AUD tag
      (Settings) → `CF_ACCESS_AUD`. Note team domain (top of dashboard,
      `<team>.cloudflareaccess.com`) → `CF_ACCESS_TEAM_DOMAIN`. Confirm
      WebAuthn login method is enabled at Settings → Authentication.
- [ ] **User work — Anthropic key**: Create at console.anthropic.com →
      API Keys → `ANTHROPIC_API_KEY`. Needed for fuel-pump OCR.
- [ ] **Portainer stack env vars** (one redeploy puts everything live):
      Set DISABLE_AUTH=false, TUNNEL_TOKEN, CF_ACCESS_TEAM_DOMAIN,
      CF_ACCESS_AUD, ANTHROPIC_API_KEY, NEXT_PUBLIC_APP_URL=
      `https://garage.duski.org`. Add `tunnel` to the stack's Profiles.
      Update the stack.
- [ ] **Verify**: Hit `https://garage.duski.org` from cellular (off
      LAN). Cloudflare Access prompts → email PIN → register passkey →
      app loads. Then Face-ID on subsequent visits. Log a test fuel
      entry with a pump-screen photo to confirm OCR works (proves
      ANTHROPIC_API_KEY is wired in).
- [ ] **Backups**: Set up Synology Hyper Backup job covering
      `/volume1/docker/automotive/`. `scripts/backup-prod-db.sh`
      already exists for ad-hoc snapshots.

## Deploy state (snapshot)
- LAN deploy live on NAS Portainer (`automotive` stack). App reachable
  at `http://192.168.0.9:3022` from the home network.
- Auto-update loop confirmed working: `git push origin main` → GH
  Actions builds → ghcr.io updated → Watchtower polls every 5 min and
  rolls the container forward.
- DB at `/volume1/docker/automotive/data/prod.db` (140 KB initial).
- Cloudflare Tunnel + Access **not** yet configured. App is currently
  LAN-only with auth disabled.
- ANTHROPIC_API_KEY not set; pump-screen OCR will fail until added.
