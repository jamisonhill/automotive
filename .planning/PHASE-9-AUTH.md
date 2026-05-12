# Phase 9 — In-app auth + multi-tenant data scoping [DONE]

Replace Cloudflare Access (gone) with hand-rolled email/password auth inside
the Next.js app. Scope every Vehicle (and everything that cascades from it)
to the user who created it, so friends each get their own private garage.

## Goals

- Friends can sign up at `https://garage.duski.org/signup`, log in, and
  track their own vehicles in isolation from each other and from the owner.
- Same UX feel as PlantLady (signup form → login form → in), but built on
  Next.js idioms (server actions, httpOnly session cookies, edge middleware
  reads the cookie) — *not* a port of PlantLady's Python backend.
- Cloudflare Tunnel stays. Cloudflare Access goes away. The middleware
  swaps "verify CF Access JWT" for "verify session cookie."
- No data loss: existing vehicles + history get assigned to the owner's
  account during the cutover.

## Non-goals (deferred)

- Email verification on signup (just trust the email).
- Forgot password flow (deferred to Phase 9.5 if needed — for friends, a
  manual password reset by the owner is fine for now).
- Social login (Google / Apple). Keep it pure email/password to keep scope
  small. Can be layered on later.
- Password change UI. Defer.
- Per-friend household sharing. Strictly private garages.
- Admin / owner-impersonation tooling. If a friend needs a reset, we run
  a one-off SQL update.

## Tech choices

- **`bcryptjs`** — pure-JS bcrypt, edge-runtime safe. Add to deps.
- **`jose`** — already in deps. Sign + verify session JWTs (HS256 with
  `SESSION_SECRET`). Same library the current CF Access middleware uses,
  so the swap is mechanical.
- **Session cookie** — name `auto_session`, httpOnly, secure, sameSite=lax,
  path=/, 30-day expiry. Issued by login server action, cleared by logout.
- **Zod** — already in deps. Reuse for signup/login validation.
- **No NextAuth.** The credentials provider in NextAuth is deliberately
  awkward and a worse fit for a hand-rolled feel.

## Sub-phase order

9a → 9b → 9c → 9d → 9e → 9f

Stop after each sub-phase, verify on the LAN deploy or laptop, commit.

---

## 9a: User model + auth server actions [DONE — `4e2f532`]

Foundation. No UI yet — verified by writing a one-off script that calls the
actions directly.

- [ ] Add `bcryptjs` + `@types/bcryptjs` to deps. `npm install`.
- [ ] Add `SESSION_SECRET` to `.env.local` (long random string, 32+ bytes).
      Document in `.env.example`.
- [ ] `prisma/schema.prisma` — add `User` model:
      ```prisma
      model User {
        id           String   @id @default(cuid())
        email        String   @unique
        passwordHash String
        createdAt    DateTime @default(now())
        updatedAt    DateTime @updatedAt
        vehicles     Vehicle[]
      }
      ```
- [ ] `prisma migrate dev --name add_user_model` locally (don't push prod
      yet — that lands in 9d).
- [ ] `src/lib/session.ts` — new file with:
      - `signSession(userId): Promise<string>` — HS256 JWT with `sub=userId`,
        30-day exp.
      - `verifySession(token): Promise<{ userId: string } | null>` — null
        on any failure (expired, bad sig, malformed).
      - `getSession(): Promise<{ userId: string, user: User } | null>` —
        reads `auto_session` cookie via `cookies()` from `next/headers`,
        verifies, looks up user. Cache with `React.cache()`.
      - `requireSession()` — throws redirect to /login if no session.
- [ ] `src/lib/validators.ts` — add `signupSchema` (email + password min 8
      + confirm match) and `loginSchema` (email + password).
- [ ] `src/app/actions/auth.ts` — new file with server actions:
      - `signUp(formData)` — validate, check email not taken, bcrypt-hash
        password (cost 12), insert User, sign session, set cookie, redirect
        to /. Friendly errors for "email already in use" + "password too
        short".
      - `signIn(formData)` — validate, look up User by email, bcrypt
        compare, sign session, set cookie, redirect to /. Generic "invalid
        credentials" error on either branch (no email enumeration).
      - `signOut()` — clear cookie, redirect to /login.
- [ ] Build + typecheck clean.

**Verify:** write `scripts/auth-smoke.ts` (don't commit) that calls signUp
+ signIn directly against a local sqlite. Confirms hashing + verification
round-trips.

---

## 9b: Signup + login pages [DONE — `962701a`]

Concrete UI. Copy the visual shape of PlantLady's LoginForm/RegisterForm if
you liked it, restyle to the automotive dark theme.

- [ ] `/login/page.tsx` — server component, email + password form posting
      to `signIn` action. Use existing `Input`, `Label`, `Button`, `Card`
      primitives. Show error from action via search param or `useFormState`
      (server-only flow is simpler — use search param `?error=…`).
- [ ] `/signup/page.tsx` — same shape, email + password + confirm-password,
      posts to `signUp`. Optional checkbox: "I agree to be friends with
      Jamison" (joking — skip the checkbox).
- [ ] Both pages: hydration-safe (no `new Date()` at render). Include a
      "Already have an account? / Don't have an account?" cross-link.
- [ ] Both pages render even with NO session (they must, otherwise login
      is unreachable). Handled by middleware allowlist in 9c.
- [ ] `/login/page.tsx` and `/signup/page.tsx` both call `getSession()` and
      redirect to `/` if already logged in — don't show login screen to
      authenticated users.
- [ ] Manual test on laptop: navigate to /signup, register, get redirected
      home, log out, log back in.

---

## 9c: Middleware swap [DONE — `87bc8cd`]

Cut over from CF Access to session cookie. After this, the app stops
trusting `cf-access-jwt-assertion` and starts trusting `auto_session`.

- [ ] Edit `src/proxy.ts`:
      - Remove `extractAccessJwt` + `verifyAccessJwt` calls.
      - Remove `DISABLE_AUTH=true` shortcut.
      - Public path allowlist: `/login`, `/signup`, `/_next/*`, `/icons/*`,
        `/manifest.webmanifest`, `/favicon.ico`. (Receipts and photos stay
        gated — they leak service history.)
      - For everything else: read `auto_session` cookie. If absent or
        invalid, redirect to `/login`.
      - On valid session: set `x-user-id` header so downstream server
        components don't re-verify. (Keep `x-user-email` parity for
        anything that displayed it.)
- [ ] Delete `src/lib/cf-access.ts`.
- [ ] Delete `CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD` / `DISABLE_AUTH`
      references from `src/lib/config.ts` (if any) and `docker-compose.yml`.
- [ ] Build + typecheck clean.
- [ ] On laptop: confirm that signed-out browser → redirected to /login;
      signed-in browser → full app loads.

---

## 9d: Multi-tenant data scoping [9d.1 + 9d.2 + 9d.4 DONE — `285f344`, prod backfill complete; 9d.3 PENDING]

The big one. Every vehicle gets a `userId`, every query gets scoped, and
existing prod data gets backfilled to the owner's account in a single
maintenance window.

### 9d.1: Schema + nullable userId

- [ ] `Vehicle` gains `userId String?` (nullable for the migration window),
      `user User? @relation(fields: [userId], references: [id])`.
- [ ] `prisma migrate dev --name add_vehicle_user_nullable`.

### 9d.2: Backfill prod

- [ ] Sign up the owner account at `https://garage.duski.org/signup`
      *first* (this is the only "anonymous" signup that will ever happen).
- [ ] `scripts/backfill-vehicle-users.ts` — script that takes a userId
      arg and does `UPDATE Vehicle SET userId = ? WHERE userId IS NULL`.
      Print row count.
- [ ] Take a DB snapshot first (`scripts/backup-prod-db.sh`).
- [ ] Run the backfill inside the prod container against the live DB.

### 9d.3: Make userId required

- [ ] Drop the `?` from `userId` in schema.
- [ ] `prisma migrate dev --name vehicle_user_required`.

### 9d.4: Scope every query

- [ ] `src/lib/queries.ts` — every Vehicle query must filter `userId`.
      Add a `getCurrentUserId()` helper that reads from headers (set by
      middleware) or session.
- [ ] `getVehicle(id)` → also check userId match; return null otherwise.
- [ ] `listVehicles()` → filter `where: { userId, isActive: true }`.
- [ ] Audit every file in `src/app/actions/*.ts` that creates a Vehicle:
      ensure userId is set from session.
- [ ] FuelEntry / ServiceEntry / TireSet / Reminder / Issue / OdometerReading
      / TirePressureLog / TreadDepthLog: their assertion functions
      (`assertSetOwnership`, etc.) already cross-check the vehicleId.
      Update those checks so they ALSO confirm `vehicle.userId === currentUserId`.
- [ ] Receipts + photo routes: `/api/receipts/[file]` and `/api/photos/[file]`
      must verify the file belongs to a Vehicle owned by the session user.
      (Today they're auth-gated but not ownership-gated. Fix.)
- [ ] CSV export route: same — scope to vehicles the user owns.

### 9d.5: Verify

- [ ] Build + typecheck clean.
- [ ] Sign up a second test account on laptop. Add a vehicle. Confirm
      the owner account does NOT see it. Confirm the test account does
      NOT see the owner's vehicles.

---

## 9e: Logout + minimal account UI [DONE]

- [ ] `/account/page.tsx` — shows email + a `signOut` button. Linked from
      the vehicle dashboard header (small user icon, top-right).
- [ ] Build + typecheck clean.
- [ ] Verified end-to-end on iPhone.

---

## 9f: Cleanup [DONE]

- [ ] Remove `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `DISABLE_AUTH` from
      `docker-compose.yml`. Add `SESSION_SECRET`.
- [ ] Edit `docs/cloudflare-setup.md` — mark Access sections as deprecated;
      keep Tunnel section (still in use).
- [ ] In Portainer stack: remove the three CF env vars, add `SESSION_SECRET`
      (generate with `openssl rand -base64 48`). Update stack.
- [ ] If the Cloudflare Access application exists in Zero Trust, delete it
      so traffic flows straight to the app without an Access prompt.
- [ ] Update `PROGRESS.md` — mark Phase 9 DONE, link to commits.

---

## Files touched (preview)

```
prisma/schema.prisma                  — add User, add userId to Vehicle
prisma/migrations/                    — three new migrations (9a, 9d.1, 9d.3)
src/lib/session.ts                    — NEW: cookie + JWT helpers
src/lib/validators.ts                 — add signupSchema, loginSchema
src/app/actions/auth.ts               — NEW: signUp, signIn, signOut
src/app/login/page.tsx                — NEW
src/app/signup/page.tsx               — NEW
src/app/account/page.tsx              — NEW
src/proxy.ts                          — rewrite to use session cookie
src/lib/cf-access.ts                  — DELETE
src/lib/queries.ts                    — scope every query by userId
src/app/actions/vehicles.ts           — set userId on create
src/app/api/receipts/[file]/route.ts  — ownership check
src/app/api/photos/[file]/route.ts    — ownership check
src/app/api/export/[...]/route.ts     — ownership check
docker-compose.yml                    — drop CF_*, add SESSION_SECRET
docs/cloudflare-setup.md              — mark Access deprecated
scripts/backfill-vehicle-users.ts     — NEW: one-off prod migration
```

## Things to remember

- **Edge runtime constraint**: anything imported by `src/proxy.ts` must be
  edge-compatible. `bcryptjs` is. `jose` is. `@prisma/client` is NOT —
  middleware can't read users directly, so the cookie carries just the
  userId, and server components do the User lookup via `getSession()`.
- **Cookie security in production**: `secure: true` requires HTTPS. The
  prod stack is HTTPS via Cloudflare Tunnel, so this is fine. For local
  dev over `http://localhost:3000`, the cookie must be `secure: false`
  conditionally on `NODE_ENV !== "production"`.
- **`SESSION_SECRET`**: must be the same across container restarts or all
  sessions invalidate. Store in Portainer stack env, never in git. If
  rotated, every user has to log back in.
- **Cost-12 bcrypt**: ~250 ms per signup/login on the NAS. Fine for a
  personal app; would not scale to a public site but we don't care.
- **No email enumeration**: signUp says "email already in use" because
  the user can already infer this via a registration attempt. signIn
  says only "invalid credentials" on either branch — never "email not
  found" vs "wrong password".
- **One-time owner signup**: after 9d.2 backfill, the owner's account
  owns all historical data. Any *new* signups go in with an empty
  garage. There is no admin claim-all flow.
