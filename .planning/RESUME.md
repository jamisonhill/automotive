# Resume — Automotive

**Paused:** 2026-05-06 (evening)
**Reason:** Phase 6a (Reminder CRUD + status engine) committed and
verified end-to-end on iPhone. Clean stopping point before 6b.
**Phase:** 6 / 8 (sub-phase 6a done; 6b next)
**Last commit:** `3835212` — Phase 6a: reminder CRUD + status engine

## Where we are

Phase 5 (Tires) is fully shipped — all three sub-phases (5a, 5b, 5c)
are committed and tested on iPhone. The Tires Current-set card now
surfaces last pressure check + tread depth + replacement projection.

Phase 6 (Reminders) is broken into three sub-phases. Agreed order:
6a → 6b → 6c. **6a is complete and shipped** — the user can create,
edit, pause, and delete reminders. The status engine computes
overdue / due-soon / ok / no_data with miles- and days-remaining.
The dashboard "Reminders" tile is reachable (basic, no badge yet).

## Resume action: start Phase 6b (ServiceEntry → Reminder auto-advance)

The status engine already does on-read merging — `resolveLastDone()`
in `src/lib/reminders.ts` walks matching ServiceEntry rows and
advances lastDone forward. So display is already correct.

What 6b adds: persistent advancement on the Reminder row itself when
a ServiceEntry is saved. Why bother if the on-read merge already
works?

1. **Performance / simplicity** — the on-read merge requires the
   reminders page to fetch every ServiceEntry for the vehicle and
   group by serviceType. Persisting lastDoneMiles/lastDoneAt removes
   that join in the common case.
2. **User trust** — when the user edits a reminder, they see
   lastDoneMiles already filled in, which feels right.
3. **Foundation for 6c notifications** — a stored "last done" lets
   us check "due since last seen" without doing a full join.

### Concrete plan for 6b

1. **Helper function** `advanceMatchingReminders` in a new
   `src/lib/reminder-advance.ts` (or inline in service.ts — TBD;
   probably its own file so it's testable).
   ```ts
   async function advanceMatchingReminders(
     vehicleId: string,
     serviceType: string,
     odometer: number,
     performedAt: Date
   ): Promise<void> {
     await prisma.reminder.updateMany({
       where: {
         vehicleId,
         serviceType,
         isActive: true,
         // Only advance forward — never backwards. Doing this in a
         // single SQL statement avoids a read-then-write race.
         OR: [
           { lastDoneMiles: null },
           { lastDoneMiles: { lt: odometer } },
         ],
       },
       data: { lastDoneMiles: odometer },
     });
     await prisma.reminder.updateMany({
       where: {
         vehicleId,
         serviceType,
         isActive: true,
         OR: [
           { lastDoneAt: null },
           { lastDoneAt: { lt: performedAt } },
         ],
       },
       data: { lastDoneAt: performedAt },
     });
   }
   ```
   Two updateMany calls because each dimension has its own
   forward-only filter; trying to do both in one statement requires
   a CASE that prisma's updateMany can't express.

2. **Hook into `src/app/actions/service.ts`**:
   - `createServiceEntry` — call `advanceMatchingReminders` after
     the ServiceEntry create succeeds, before revalidatePath.
   - `updateServiceEntry` — same. Edge case: if the user edits the
     entry to a *different* serviceType, we'd ideally roll back the
     old reminder advance. **Decision: don't.** Rolling back requires
     a full history scan to find what the new effective lastDone
     should be, and is rare. Document this as a known behavior; the
     user can edit the reminder by hand if needed.
   - `deleteServiceEntry` — same: don't roll back. Rare and complex.

3. **Skip "custom" serviceType** — every custom entry is unique by
   definition, so no reminder will ever match. The helper short-
   circuits when serviceType === "custom".

4. **Test on iPhone**:
   - Create a "Oil change" reminder with no lastDone.
   - List shows "No last-done data yet" status (no_data).
   - Add a service entry, type=oil_change, mileage=42000, performedAt=today.
   - Reminders page now shows that reminder with miles/days remaining
     based on (42000, today).
   - Edit that service entry, bump mileage to 42500 → reminder
     advances to 42500.
   - Edit it back to 41000 (lower) → reminder does NOT regress.

5. **Build + typecheck clean** before commit.

## Files relevant to 6b work

```
src/lib/reminder-advance.ts        — NEW (the helper)
src/app/actions/service.ts         — call helper from create + update
src/lib/reminders.ts               — already exists; no change
prisma/schema.prisma               — no change (Reminder model already
                                     has lastDoneMiles + lastDoneAt)
```

## To restart dev

```bash
cd /Users/jamisonhill/Ai/automotive
npm run dev
```

Open `http://localhost:3000` (laptop) or `http://192.168.0.16:3000`
(iPhone). LAN IP is allow-listed in `next.config.ts`.

## Things to remember when resuming

- **Hydration safety**: never call `new Date()` at component-render
  time. Use a server-stable seed; set "now" in a post-mount handler
  if you need it.
- **Form encType**: don't set `encType` on a `<form>` whose action is
  a server-action function — React handles it. Setting it triggers a
  console warning on iPhone.
- **isActive checkbox quirk**: hidden "off" must come BEFORE the
  checkbox so the checkbox value (when present) wins. The
  `formDataToObject` helper in `src/lib/validators.ts` keeps the
  LAST value for a given name.
- **Cross-vehicle defense**: every per-row server action confirms the
  row belongs to the requesting vehicle before write. Match this
  pattern in 6b helpers if any are added.
- **Forward-only advancement**: a reminder's lastDone* fields should
  never regress. Service-entry edits that lower the value should be
  ignored.
- **Dev server LAN access**: `next.config.ts` has
  `allowedDevOrigins: ["192.168.0.16"]`.

## Sub-phase queue after 6b

- **6c** — Dashboard surface (Reminders tile with count badge +
  warning color, mirroring Warranties pattern) and a "Add common
  reminders" seed button (oil 5k/6mo, rotation 5k, filters
  15k/24mo, brake fluid 24mo, state inspection 12mo, wipers 12mo,
  skipping serviceTypes already present).

## After Phase 6: 7 (analytics) + 8 (polish)

- Phase 7: cost-per-mile, MPG trends, year-over-year, total cost of
  ownership.
- Phase 8: PWA install (manifest + icons), CSV export, receipt
  photo gallery.

## Deploy state

Still local-only. Not pushed to GitHub yet (will be after this pause).
NAS Portainer stack not deployed. Cloudflare Tunnel + Access not
configured. All deploy infra written and ready (Dockerfile, GH
Actions, docker-compose.yml, docs).

## Recent commit history

```
3835212 Phase 6a: reminder CRUD + status engine
bf8642f Phase 5c: tread depth log + replacement projection
8b7e537 Phase 5b: per-corner pressure log
1f43d49 pause: Phase 5a done, resuming at Phase 5b (pressure log)
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
