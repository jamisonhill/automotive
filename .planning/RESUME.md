# Resume — Automotive

**Paused:** 2026-05-02 (evening)
**Reason:** Phase 3 fuel + OCR built, awaiting OCR verification with real Anthropic
API key and a real pump-screen photo from iPhone Safari.
**Phase:** 3 / 8
**Commit at pause:** see `pause:` commit on `main`

## Where we are
Phase 3 (Odometer + Fuel) is fully implemented and the production build is
green. The user already verified that the **partial fill** form path works
end-to-end ("partial fill is good"). The remaining unknowns are:

1. Whether the Claude vision OCR returns sensible JSON when given an actual
   pump-screen photo (no API key set yet locally).
2. Whether iPhone Safari fires the camera correctly via
   `<input type="file" capture="environment">` and whether the HEIC photos
   get re-encoded to JPEG by the client-side `resizeImageForOcr` helper.

## Files that landed in this session

```
src/lib/anthropic.ts            — SDK singleton + VISION_MODEL constant
src/lib/ocr.ts                  — pumpOcr(): system-prompt-cached vision call
src/lib/fuel.ts                 — computeTripStats, recomputeFuelMpgFrom, summarize
src/lib/image-resize.ts         — client-side canvas resize → JPEG blob
src/app/actions/fuel.ts         — createFuelEntry, updateFuelEntry, deleteFuelEntry,
                                  extractPumpData, logOdometer
src/components/fuel-form.tsx    — client component (camera, OCR, auto-derive cost)
src/components/sparkline.tsx    — SVG line chart, no deps
src/app/vehicles/[id]/fuel/page.tsx                — list + stats + chart
src/app/vehicles/[id]/fuel/new/page.tsx            — add fill-up
src/app/vehicles/[id]/fuel/[entryId]/edit/page.tsx — edit/delete fill-up
src/lib/validators.ts           — added fuelSchema and odometerSchema
src/lib/queries.ts              — getVehicle now includes most-recent fuelEntries
src/app/vehicles/[id]/page.tsx  — Fuel tile is enabled and shows last MPG
```

## Next action when resuming

1. **Set the API key** — add to `.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
2. **Restart dev** — `npm run dev` (env changes don't hot-reload)
3. **Manual fuel test (already verified, just sanity check)**
   - Open vehicle → Fuel & MPG → Add fill-up → fill in odometer/gallons/total → save
4. **OCR test on iPhone**
   - Open the dev URL on iPhone Safari (laptop LAN IP)
   - Add fill-up → tap **Snap pump screen**
   - Confirm camera UI opens (rear lens by default)
   - Take a photo of any pump display
   - Within ~2 seconds, gallons / total / $/gal / octane should auto-fill
   - If it errors: copy the error text and we'll debug
5. **MPG verification** — once 2+ full fills exist, the sparkline should appear
   on the fuel page; tap the entries to verify tripMpg values look right
6. **Commit Phase 3** — once OCR is verified, ask Claude to commit with a
   "Phase 3:" message

## Known limitations carried forward

- iPhone HEIC photos: the resize helper draws to a canvas which Safari
  decodes natively, so HEIC → JPEG happens automatically. If HEIC fails,
  the fallback message will be a Claude OCR error like "Unsupported image
  type". Tell the user to set iPhone Camera → Formats → "Most Compatible".
- Out-of-order fuel entries: `recomputeFuelMpgFrom` handles this, but the
  user has no UX to spot it. Acceptable for v1.
- No auth yet on the OCR endpoint other than the (disabled in dev) CF
  Access proxy. In production it's gated by Cloudflare Access.

## To restart dev
```bash
cd /Users/jamisonhill/Ai/automotive
npm run dev
```
Then open `http://localhost:3000` (laptop) or `http://<lan-ip>:3000` (iPhone).

## How to test on iPhone
1. On laptop: `ipconfig getifaddr en0` → note the IP
2. On iPhone Safari: visit `http://<that-ip>:3000`
3. Add to Home Screen for the PWA-feel experience (Phase 8 polishes this)
