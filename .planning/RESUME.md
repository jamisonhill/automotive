# Resume — Automotive

**Paused:** 2026-05-11
**Reason:** Everything from the original roadmap shipped. The app is
live, multi-tenant, and in active use. No "Phase 10" is pre-planned —
the next feature should be driven by actual usage, not anticipated.
**Phase:** All complete. App in maintenance/active-use mode.
**Last commit:** `4f850a5` — Phase 9d.3 + 9f: NOT NULL flip + docs cleanup

## What ships today

- **Live URL**: `https://garage.duski.org` (Cloudflare Tunnel → NAS).
- **Auth**: email/password signup at `/signup`, login at `/login`,
  account view + sign-out at `/account`. 30-day httpOnly session cookie
  signed with `SESSION_SECRET`.
- **Multi-tenant**: every Vehicle row is owned by a User. Queries
  scoped at every layer (pages, actions, route handlers). Friends each
  get a private garage.
- **OCR**: Anthropic API key wired, fuel-pump photo extraction working.
- **PWA**: home-screen install on iPhone with branded icon.
- **CI/CD**: push to main → GitHub Actions builds image → ghcr.io →
  Watchtower polls every 5 min → container auto-rolls. ~10 min from
  `git push` to live.

## Owner account

`jamison.hill@me.com` — owns the original vehicle and all historical
data (assigned via the cutover backfill).

## Operational reference

### Add an env var (e.g., new feature key)
Portainer → Stacks → `automotive` → Editor → add to "Environment
variables" → Update the stack. Compose only forwards an allowlist of
env names — if a new one's needed, edit `docker-compose.yml` to add
the line `VAR_NAME: "${VAR_NAME:-default}"`.

### Manual password reset for a friend
Until a self-serve reset flow exists, run a one-off update:
```bash
ssh nas-home
sudo /usr/local/bin/docker exec automotive node --input-type=module -e '
  import bcrypt from "bcryptjs";
  import { PrismaClient } from "@prisma/client";
  const p = new PrismaClient();
  const hash = await bcrypt.hash("the-new-password", 12);
  await p.user.update({ where: { email: "friend@example.com" }, data: { passwordHash: hash } });
  await p.$disconnect();
'
```

### Manual DB snapshot before risky ops
```bash
ssh nas-home
bash ~/automotive/scripts/backup-prod-db.sh    # path may differ on NAS
```

### Apply a Prisma schema change to prod
After pushing the schema change + new migration, wait for Watchtower
(or trigger via Portainer "Update the stack" → Re-pull), then:
```bash
ssh nas-home
sudo /usr/local/bin/docker exec automotive sh -c '
  npx -y prisma@6 db push --schema=/app/prisma/schema.prisma
'
```

### Forgot which userId owns what
```bash
sudo /usr/local/bin/docker exec automotive node --input-type=module -e '
  import { PrismaClient } from "@prisma/client";
  const p = new PrismaClient();
  console.log(await p.user.findMany({
    select: { id: true, email: true, _count: { select: { vehicles: true } } }
  }));
  await p.$disconnect();
'
```

## Local dev

```bash
cd /Users/jamisonhill/Ai/automotive
npm run dev
```

Open `http://localhost:3000` (laptop) or `http://192.168.0.16:3000`
(iPhone — LAN IP allow-listed in `next.config.ts`). `.env.local` must
have `SESSION_SECRET` set (32+ chars).

## Things that could come next (if real usage surfaces a need)

- Password reset flow (currently manual SQL — see above).
- Email verification on signup (currently trusts the email).
- Email reminders when service is due (uses existing reminder engine).
- Household sharing (two users on one garage — User ↔ Vehicle becomes
  many-to-many via a Household join). Plan-mode change.
- Friend invite link instead of "go to this URL and sign up".
- Per-service before/after photos (today only receipts attach).

Premature feature work is the enemy of a clean personal app — pull
from this list only when actual usage proves the need.

## Recent commit history

```
4f850a5 Phase 9d.3 + 9f: NOT NULL flip + docs cleanup
516d498 Phase 9e: /account page with sign-out
ff80bf2 docs: Phase 9a-9d.4 + partial 9f marked done, prod cutover complete
370734c fix: wire SESSION_SECRET through compose env
38b9446 deploy: ship scripts/ in image + convert backfill to plain .mjs
285f344 Phase 9d.1 + 9d.4: scope every vehicle query by current user
87bc8cd Phase 9c: swap middleware from CF Access to session cookie
962701a Phase 9b: /login and /signup pages
4e2f532 Phase 9a: User model + auth server actions + session helpers
bda901f plan: Phase 9 — in-app auth + multi-tenant scoping
a8bd161 pause: D1 LAN deploy verified, resuming at D2 (Cloudflare + OCR)
```
