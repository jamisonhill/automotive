# Deploying Automotive to the home NAS via Portainer

This walks through the one-time setup. After this, every `git push` to `main` triggers GitHub Actions to build and push a new image; Watchtower on the NAS picks it up within ~5 minutes and restarts the container with the new code.

---

## Prerequisites

- Synology home NAS (192.168.0.9) with **Container Manager / Docker** installed
- **Portainer** running on the NAS
- The GitHub repo `automotive` is pushed and the GitHub Actions workflow has run at least once (so an image exists at `ghcr.io/<your-user>/automotive:latest`)
- You've completed `docs/cloudflare-setup.md` and have:
  - `TUNNEL_TOKEN`
  - `CF_ACCESS_TEAM_DOMAIN`
  - `CF_ACCESS_AUD`
- An Anthropic API key for pump-screen OCR

---

## Step 1 — Make ghcr.io image pullable

By default ghcr.io packages created by GitHub Actions are **private**. Two options:

**Option A (simpler):** Make the package public.
1. Go to `github.com/<you>?tab=packages` → click `automotive`.
2. **Package settings** → **Change visibility** → **Public**.

**Option B (private):** Generate a PAT and tell Watchtower how to authenticate.
1. GitHub **Settings → Developer settings → Personal access tokens (classic)** → generate a token with `read:packages` scope.
2. On the NAS, create `/volume1/docker/watchtower/config.json` with:
   ```json
   {
     "auths": {
       "ghcr.io": {
         "auth": "<base64 of  github-username:PAT>"
       }
     }
   }
   ```
3. Uncomment the `config.json` volume mount in `docker-compose.yml`.

Either way is fine for a personal app — public is easier.

---

## Step 2 — Prepare the NAS data directory

SSH into the NAS or use the File Station UI to create the data folder:

```bash
mkdir -p /volume1/docker/automotive/data
```

The container runs as uid 1001. Make sure that uid can write to the folder:

```bash
chown -R 1001:1001 /volume1/docker/automotive/data
```

(If you're not comfortable changing ownership, `chmod 777` on a folder that only you can read is fine on a single-user home NAS.)

---

## Step 3 — Create the Portainer stack

1. Open Portainer → **Stacks** → **Add stack**.
2. **Name**: `automotive`.
3. **Build method**: **Web editor** — paste the contents of `docker-compose.yml` from this repo.
4. Replace `<github-username>` in the `image:` line with your actual GitHub username.
5. Scroll to **Environment variables** → **Add an environment variable** for each of:

   | Key | Value |
   |---|---|
   | `TUNNEL_TOKEN` | the long string from CF Tunnel setup |
   | `CF_ACCESS_TEAM_DOMAIN` | `<team>.cloudflareaccess.com` |
   | `CF_ACCESS_AUD` | hex AUD tag from Access app |
   | `ANTHROPIC_API_KEY` | `sk-ant-…` |

6. **Deploy the stack**.

Portainer pulls the three images, starts them, and they begin talking on the `tunnel` network.

---

## Step 4 — Initialize the database

The first time the container starts there's no SQLite file yet. Push the schema:

```bash
# From your laptop, against the NAS container:
docker exec -it automotive npx prisma db push
```

Or do it once locally before deploy and copy `dev.db` over. Either works.

> Future schema changes will be handled by Prisma migrations — covered when we add them.

---

## Step 5 — Verify

1. From the NAS or any device on the LAN: `curl -I http://<nas-ip>:3000` should NOT respond — we don't expose the port to the host. That's correct.
2. Open `https://cars.duski.org` on your iPhone.
3. Cloudflare Access prompt appears → log in via email PIN → register passkey → app loads.
4. Future visits = Face ID tap, in.

---

## Updating

Every push to `main` → GH Actions builds → ghcr.io updated → within ~5 min Watchtower pulls and restarts the container. **Zero manual deploy steps.**

If you want to force-update immediately rather than wait for the poll, in Portainer click **Stacks → automotive → Pull and redeploy**.

---

## Backups

Snapshot `/volume1/docker/automotive/data` on whatever cadence your Synology Hyper Backup is set to. Restoring is just dropping the folder back and restarting the stack.

For a quick manual export:

```bash
cp /volume1/docker/automotive/data/prod.db ~/automotive-backup-$(date +%F).db
```
