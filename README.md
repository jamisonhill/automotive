# Automotive

Personal car maintenance and metrics tracker. Built for iPhone Safari, dark mode only, multi-vehicle. Runs on the home NAS, accessed worldwide via Cloudflare Tunnel + Access (Face ID auth, no password).

## What it tracks

- **Vehicles** — year/make/model/trim, VIN, engine, drivetrain, purchase info, photos
- **Used-car baseline** — tread depth per corner, brake pad thickness, battery age/CCA, fluid conditions, belts/hoses, known issues at time of acquisition
- **Fuel** — fill-ups with running MPG, cost-per-mile, OCR from pump-screen photos via Claude vision
- **Maintenance** — oil, fluids, filters, brakes, plugs, battery, etc., with reminder intervals
- **Major repairs** — alternators, starters, water pumps, etc., with part numbers, brands, warranty tracking, and per-component history
- **Tires** — tire sets, rotations, pressure logs (per corner), tread-depth tracking with replacement projection
- **Issues / DTCs** — symptoms and diagnostic codes, optionally linked to the repair that resolved them
- **Analytics** — MPG trends, cost-per-mile, total cost of ownership, upcoming services

## Stack

- **Next.js 16** (App Router, TypeScript, server actions)
- **Prisma** + **SQLite** (DB lives in `/data` volume on NAS)
- **Tailwind v4** with a hand-tuned dark-only theme + iOS-feeling component primitives
- **Cloudflare Access** for auth — passkey/Face ID, no in-app login screen
- **Claude Haiku** vision for pump-screen OCR
- **Docker** image published to **ghcr.io** by GitHub Actions
- **Watchtower** on the NAS auto-updates the running container ~5 min after any push to `main`

## Local dev

```bash
# 1. Install deps and generate Prisma client
npm install

# 2. Copy env file and edit
cp .env.example .env.local
# At minimum, set:
#   DISABLE_AUTH=true    (so you can hit the app without Cloudflare in front)
#   DATABASE_URL="file:./dev.db"

# 3. Push schema to a fresh SQLite DB
npx prisma db push

# 4. Run dev server
npm run dev
```

Open <http://localhost:3000>.

### Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build (also generates Prisma client) |
| `npm run start` | Run the production build locally |
| `npm run typecheck` | Strict TypeScript check, no emit |
| `npm run db:push` | Push schema changes to DB without a migration |
| `npm run db:migrate` | Create a named migration |
| `npm run db:studio` | Browse the DB in Prisma Studio |

## Deploy

The production deploy is fully automated:

1. `git push origin main` →
2. GitHub Actions builds the Docker image and pushes to `ghcr.io/<you>/automotive:latest` →
3. Watchtower on the NAS pulls and restarts within ~5 min.

First-time setup on the NAS, the Cloudflare side, and Face ID enrollment:

- **`docs/cloudflare-setup.md`** — Cloudflare Tunnel + Access + WebAuthn (passkey) for `cars.duski.org`
- **`docs/nas-deploy.md`** — Portainer stack with `cloudflared`, Watchtower, and the app

## Project layout

```
.
├── prisma/schema.prisma         # Full data model (Vehicle, ServiceEntry, etc.)
├── src/
│   ├── app/                     # Next.js App Router pages
│   │   ├── layout.tsx           # Root layout (dark theme, PWA bits)
│   │   ├── page.tsx             # Garage / vehicle picker
│   │   └── globals.css          # Tailwind + dark-only theme tokens
│   ├── components/ui/           # Button, Card, Input, Label primitives
│   ├── lib/
│   │   ├── db.ts                # Prisma client singleton
│   │   ├── cf-access.ts         # Cloudflare Access JWT verification
│   │   └── utils.ts             # cn() class-merge helper
│   └── proxy.ts                 # Edge proxy — gates all requests on CF Access JWT
├── docker-compose.yml           # Production stack: app + cloudflared + watchtower
├── Dockerfile                   # Multi-stage build → Next standalone runtime
├── docs/
│   ├── cloudflare-setup.md
│   └── nas-deploy.md
└── .github/workflows/deploy.yml # Build & push image to ghcr.io
```

## Build phases

- [x] **Phase 1 — Foundation**: scaffold, schema, dark theme, CF Access, Docker pipeline, deploy guides
- [ ] **Phase 2 — Vehicles + Baseline**: 4-car picker, used-car baseline intake form
- [ ] **Phase 3 — Odometer + Fuel**: fill-up entry, pump-photo OCR, MPG charts
- [ ] **Phase 4 — Maintenance + Repairs**: unified service log, component history, warranty tracking
- [ ] **Phase 5 — Tires**: sets, rotations, pressure log, tread depth
- [ ] **Phase 6 — Reminders**: interval engine, "due soon" dashboard
- [ ] **Phase 7 — Analytics**: cost-per-mile, MPG trends, year-over-year
- [ ] **Phase 8 — Polish**: PWA install, CSV export, photo gallery
