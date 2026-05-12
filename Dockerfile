# =============================================================================
# Automotive — multi-stage Dockerfile
# =============================================================================
# Strategy:
#   1. `deps`    — install npm deps with cached layer (changes rarely)
#   2. `builder` — copy source, generate Prisma client, build Next.js standalone
#   3. `runner`  — minimal runtime image with only what's needed to serve
#
# The standalone output (next.config.ts: output: "standalone") gives us a
# minimal node_modules tree, dropping the final image to roughly 200–250 MB.
# =============================================================================

# ---------- Stage 1: install dependencies ----------
FROM node:22-alpine AS deps
# libc6-compat is required for some native deps (Prisma engines) on Alpine.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy only the manifest files first so this layer caches independently of
# source changes. `npm ci` is reproducible and faster than `npm install`.
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci


# ---------- Stage 2: build ----------
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Next.js telemetry during build.
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client (postinstall already ran, but re-run to be explicit
# in case the schema was modified after install). Then build Next.
RUN npx prisma generate
RUN npm run build


# ---------- Stage 3: runtime ----------
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as a non-root user. Alpine's `node` image already creates uid 1000,
# but we create a dedicated user to make file ownership explicit on the
# /data volume mount.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# Copy the standalone build output. This includes a minimal node_modules
# tree and the compiled .next/standalone server.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma needs the schema and the engine binaries at runtime to query SQLite.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Ship one-off maintenance scripts (e.g. Phase 9 vehicle backfill) so they
# can be executed inside a running container without rebuilding the image.
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# /data is the persistent volume mount point — SQLite DB and uploaded photos
# live here. Pre-create with correct ownership so Portainer's bind mount works.
RUN mkdir -p /data/photos /data/receipts && chown -R nextjs:nodejs /data
VOLUME ["/data"]

USER nextjs
EXPOSE 3000

# server.js is the entrypoint produced by Next.js standalone output.
CMD ["node", "server.js"]
