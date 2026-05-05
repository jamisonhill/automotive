# Resume — Automotive

**Paused:** 2026-05-04 (evening)
**Reason:** Phase 4a (ServiceEntry CRUD + receipts) committed and verified
end-to-end on iPhone. Clean stopping point before starting Phase 4c.
**Phase:** 4 / 8 (sub-phase 4a done; 4c next)
**Last commit:** `0327078` — Phase 4a: ServiceEntry CRUD + receipts

## Where we are

Phase 4 ("Maintenance + Repairs") is split into five sub-phases. The
agreed order of attack is **4a → 4c → 4b → 4d → 4e**. The reason: 4a
gives us the data spine, 4c (Issues/DTCs) is independent and quick to
ship, and 4b/4d/4e are polish + derived views that benefit from real
data first.

**Phase 4a is complete and shipped.** The user has tested it several
ways on the iPhone with no outstanding issues. Service entries, receipt
upload (image + PDF), edit/delete, oil-change preset, and the repair
narrative section all work. Vehicle dashboard tile shows the last
service date.

## Resume action: start Phase 4c (Issue / DTC log)

The `Issue` model already exists in `prisma/schema.prisma`:

```prisma
model Issue {
  id                     String    @id @default(cuid())
  vehicleId              String
  reportedAt             DateTime  @default(now())
  reportedMileage        Int?
  status                 String    // 'open' | 'monitoring' | 'resolved'
  symptom                String
  diagnosis              String?
  dtcCodes               String?   // comma-separated like "P0301,P0302"
  resolvedAt             DateTime?
  resolvedServiceEntryId String?
  notes                  String?
}
```

There's also a one-way link from `ServiceEntry.resolvedIssueId` back to
the issue that prompted a repair — so 4c needs to optionally show "fixed
by [service entry]" when an issue is resolved.

### Concrete plan for 4c

Mirror the Phase 4a pattern (which mirrors the Phase 3 fuel pattern):

1. **`issueSchema`** in `src/lib/validators.ts`
   - Required: vehicleId-bound, symptom, status enum
     (`open`/`monitoring`/`resolved`), reportedAt
   - Optional: reportedMileage, diagnosis, dtcCodes (string, raw —
     normalize to comma-separated uppercase in the action),
     resolvedAt, resolvedServiceEntryId, notes
   - On status='resolved', resolvedAt should default to now if blank

2. **`src/app/actions/issues.ts`**
   - `createIssue(vehicleId, formData)` — sets reportedMileage from
     latest odometer reading if blank
   - `updateIssue(vehicleId, issueId, formData)` — handles status
     transitions, syncs resolvedAt
   - `resolveIssue(vehicleId, issueId, serviceEntryId)` — convenience
     action that closes an issue and links to the service entry that
     fixed it. Bidirectional: also sets
     `ServiceEntry.resolvedIssueId = issueId`
   - `deleteIssue(vehicleId, issueId)`

3. **`src/components/issue-form.tsx`** — client component
   - Symptom (required, textarea)
   - Status (radio or select: open / monitoring / resolved)
   - Reported when (datetime-local) + odometer
   - DTC codes (text input — comma or newline separated, normalize
     server-side)
   - Diagnosis (textarea)
   - Resolution section (only when status=resolved): resolvedAt,
     dropdown picker of service entries to link
   - Notes
   - Hydration-safe: same `seededReportedAt` pattern as fuel/service

4. **Pages**
   - `/vehicles/[id]/issues` — list with status pills, filter buttons
     (All / Open / Monitoring / Resolved)
   - `/vehicles/[id]/issues/new`
   - `/vehicles/[id]/issues/[issueId]/edit`

5. **Wire-up**
   - `src/lib/queries.ts` — `getVehicle` includes open issue count
   - Vehicle dashboard: replace placeholder "Issues & DTCs" tile with
     a real link, showing open-issue count badge
   - Update icon import on the vehicle page if needed

6. **Build + typecheck clean** before the commit

## Files relevant to 4c work

```
prisma/schema.prisma              — Issue model (already there)
src/lib/validators.ts             — add issueSchema
src/app/actions/issues.ts         — NEW
src/components/issue-form.tsx     — NEW
src/app/vehicles/[id]/issues/page.tsx                    — NEW (list)
src/app/vehicles/[id]/issues/new/page.tsx                — NEW (add)
src/app/vehicles/[id]/issues/[issueId]/edit/page.tsx     — NEW (edit/delete)
src/lib/queries.ts                — bump getVehicle to include open count
src/app/vehicles/[id]/page.tsx    — enable the Issues & DTCs tile
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
  time for an initial state. Use a server-stable seed (empty string for
  new entries; persisted value for edits) and either set "now" in a
  post-mount handler or leave it for the user to pick.
- **iPhone form quirks** (only matter for the issue form if we add file
  upload, which 4c doesn't need): file inputs with
  `capture="environment"` must live OUTSIDE the `<form>` and be linked
  via `<label htmlFor>`.
- **Form encType**: don't set `encType` on a `<form>` whose action is a
  server-action function — React handles it. Setting it triggers a
  console warning on iPhone.
- **Dev server LAN access**: `next.config.ts` already has
  `allowedDevOrigins: ["192.168.0.16"]`. If LAN IP changes, that needs
  updating.

## Sub-phase queue after 4c

- **4b** — Service form polish (warranty defaults from catalog, tighter
  conditional sections)
- **4d** — Component history view (per-serviceType timeline, miles
  between replacements)
- **4e** — Warranty tracking dashboard

## Deploy state

Still local-only. Not pushed to GitHub. NAS Portainer stack not
deployed. Cloudflare Tunnel + Access not configured. All deploy infra
written and ready (Dockerfile, GH Actions, docker-compose.yml, docs).
