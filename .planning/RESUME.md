# Resume — Automotive

**Paused:** 2026-05-08
**Reason:** All 8 feature phases shipped + LAN deploy on home NAS is
live and verified. Stopping before the manual Cloudflare Tunnel /
Access / Anthropic prod-up work, which is browser-UI-clicking the
user has to do themselves.
**Phase:** Deploy / D2 (full prod) — D1 (LAN) is DONE
**Last commit:** `4aed1f0` — deploy: switch domain to garage.duski.org + add ad-hoc DB backup script

## Where we are

All eight feature phases (1–8) are complete and committed. Phase 8c
(receipt photo gallery) was the last code work. After that we shipped
the deployment infrastructure:

- GitHub Actions builds + publishes `ghcr.io/jamisonhill/automotive:latest`
  on every push to `main`. Confirmed working as of commit `d2e4da0`
  (the fix for the static prerender / DATABASE_URL crash).
- Portainer stack `automotive` is live on the home NAS via Repository
  method. App reachable on the LAN at **http://192.168.0.9:3022**.
- SQLite DB initialized at `/volume1/docker/automotive/data/prod.db`.
- Watchtower polls ghcr every 5 min and auto-rolls the container.
- User confirmed the iPhone load works on the LAN.

The compose has been refactored so cloudflared is in a `tunnel`
profile (opt-in). DISABLE_AUTH defaults to true. All Cloudflare and
Anthropic env vars are optional with `${VAR:-default}` substitution.
This means the LAN stack starts cleanly without any Cloudflare config.

## Resume action: D2 — full prod (Cloudflare Tunnel + Access + OCR)

Three browser-UI tasks the user owns, then one Portainer redeploy puts
everything live. The Cloudflare doc is `docs/cloudflare-setup.md` —
already updated to use `garage.duski.org`.

### 1. Cloudflare Tunnel (Zero Trust dashboard)
- Networks → Tunnels → Create tunnel `home-nas-automotive` (or reuse
  an existing home-NAS tunnel and add a hostname to it).
- Copy the long string after `--token` from the install command →
  this is `TUNNEL_TOKEN`.
- Public Hostname page:
  - Subdomain: `garage`
  - Domain: `duski.org`
  - Service Type: `HTTP`
  - URL: `automotive:3000`  ← the docker service name + container port
  Cloudflare auto-creates the CNAME `garage.duski.org → <tunnel>.cfargotunnel.com`.

### 2. Cloudflare Access application
- Zero Trust → Access → Applications → Add application → Self-hosted.
- Name: `Automotive`. Session: `1 month`.
- Application domain: subdomain `garage`, domain `duski.org`.
- Identity providers: leave One-time PIN enabled (used once to
  bootstrap before passkey takes over).
- Policy: name `Owner only`, Action `Allow`, Include → Emails →
  `jhill@mercyhillchurch.com`.
- After creation, open the app → Settings → Overview → copy the
  **Application Audience (AUD) Tag** → that's `CF_ACCESS_AUD`.
- Note the team domain (top of Zero Trust dashboard, looks like
  `<team>.cloudflareaccess.com`) → `CF_ACCESS_TEAM_DOMAIN`.
- Confirm WebAuthn is enabled at Settings → Authentication → Login
  methods (so passkey / Face ID works on iPhone).

### 3. Anthropic API key
- console.anthropic.com → API Keys → Create. Optionally scope to a
  workspace for isolated billing. Copy the `sk-ant-…` value →
  `ANTHROPIC_API_KEY`. Used by the fuel-pump OCR feature only.

### 4. Portainer redeploy (one update brings it all live)
Open Portainer (http://192.168.0.9:9000) → Stacks → `automotive` →
edit. Set these stack environment variables:

| Key | Value |
|---|---|
| `DISABLE_AUTH` | `false` |
| `TUNNEL_TOKEN` | (from step 1) |
| `CF_ACCESS_TEAM_DOMAIN` | (from step 2) |
| `CF_ACCESS_AUD` | (from step 2) |
| `ANTHROPIC_API_KEY` | (from step 3) |
| `NEXT_PUBLIC_APP_URL` | `https://garage.duski.org` |

In the stack's **Profiles** field add `tunnel`. Update the stack.
Watchtower won't interfere — it only updates app images, not the
stack definition. Portainer will recreate `automotive` with the new
env and bring up `cloudflared-automotive`.

### 5. Verify (assistant work)
- From cellular (off the LAN), open `https://garage.duski.org`.
- Cloudflare Access prompt appears → enter email → 6-digit PIN from
  email → app prompts to register a passkey → Face ID → registered.
- Sign out, revisit, choose Passkey → Face ID → in.
- Log a test fuel entry with a real pump-screen photo to confirm
  OCR works (this proves ANTHROPIC_API_KEY is wired correctly).
- Check `cloudflared-automotive` logs in Portainer for "Registered
  tunnel connection" lines (no auth errors).

### 6. Backups
- Synology Control Panel → Hyper Backup → new job covering
  `/volume1/docker/automotive/`. Pick a schedule (daily is fine for
  a personal app).
- `scripts/backup-prod-db.sh` is already in the repo for ad-hoc
  snapshots before risky operations.

## Files relevant to D2

```
docs/cloudflare-setup.md       — full walkthrough of the Cloudflare work
docs/nas-deploy.md             — Portainer + NAS context
docker-compose.yml             — `tunnel` profile + ${VAR:-default} env
scripts/backup-prod-db.sh      — ad-hoc DB snapshot
src/proxy.ts                   — middleware that reads CF_ACCESS_* + DISABLE_AUTH
```

## Things to remember when resuming

- **NAS connection**: SSH alias `nas-home` (192.168.0.9). Sudo
  password `Pats4ouk`. docker-compose binary is at
  `/usr/local/bin/docker-compose`. See `/NAS-Home` skill for full
  context.
- **Portainer URL**: http://192.168.0.9:9000.
- **Auto-update is on**: any push to `main` will roll the container
  forward within ~5 minutes. So feature work doesn't require any
  redeploy steps — just push.
- **Prisma CLI gotcha**: the runtime image doesn't ship the Prisma
  CLI. To run migrations / db push inside the container, use
  `npx -y prisma@6 ...` so it pins to v6 (matches the schema).
  Default `npx prisma` would fetch v7 which dropped `url` from
  schema.prisma.
- **Container naming**: ours is namespaced `cloudflared-automotive`
  and `watchtower-automotive` to coexist with the existing
  `cloudflare` and `watchtower-devotional` containers on the NAS.
- **Port 3022**: stays exposed even after the tunnel is live. The
  tunnel can target either the docker service name (`automotive:3000`)
  or `localhost:3022` on the NAS.

## To restart dev (laptop, unrelated to the prod deploy)

```bash
cd /Users/jamisonhill/Ai/automotive
npm run dev
```

Open `http://localhost:3000` (laptop) or `http://192.168.0.16:3000`
(iPhone). LAN IP allow-listed in `next.config.ts`.

## Recent commit history

```
4aed1f0 deploy: switch domain to garage.duski.org + add ad-hoc DB backup script
31643e0 deploy: LAN-only by default, tunnel as opt-in profile
1270c27 deploy: pin GitHub username + namespace cloudflared/watchtower containers
d2e4da0 fix: mark / as dynamic so Docker build doesn't prerender Prisma calls
59cf9ba docs: mark Phase 8 (Polish) DONE in PROGRESS.md — all phases complete
c2476c2 Phase 8c: receipt photo gallery
a51fb51 Phase 8b: CSV export per vehicle
7dc78eb Phase 8a: PWA manifest + home-screen icons
5caf9aa docs: mark Phase 7 (Analytics) DONE in PROGRESS.md
6c112e6 Phase 7b: analytics trends — MPG sparkline + year-over-year table
ddc5abc Phase 7a: per-vehicle analytics — lifetime numbers + TCO
edc3903 docs: mark Phase 6 (Reminders) DONE in PROGRESS.md
02c3455 Phase 6c: dashboard reminders tile + common-reminders seed
360ed08 Phase 6b: ServiceEntry → Reminder auto-advance + date-only service form
```
