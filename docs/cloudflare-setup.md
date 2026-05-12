# Cloudflare Tunnel + Access setup for `garage.duski.org`

> **⚠️ DEPRECATED (Phase 9, 2026-05-12):** Cloudflare Access is no longer
> used. Auth lives in the app itself now (email/password → bcrypt hash →
> signed session cookie verified by `src/proxy.ts`). Multiple users can
> sign up — each has a private garage.
>
> The **Cloudflare Tunnel** half of this guide is still accurate:
> `garage.duski.org` continues to route Cloudflare → Tunnel → NAS
> container. Nothing about the tunnel changed.
>
> The **Cloudflare Access** sections (Step 3, Step 4, Step 6) describe
> the old auth model and should be ignored. If a Zero Trust Access
> Application named "Automotive" exists for `garage.duski.org`, it can
> be safely deleted — the in-app middleware does the auth gating now.
>
> Kept as a record of the original deploy. See `.planning/PHASE-9-AUTH.md`
> for the current auth design.

---

Goal: expose the app to the internet through a Cloudflare Tunnel (no open ports on the NAS), with Cloudflare Access in front so only you can reach it — and so authentication is **Face ID via passkey**, no password screen in the app itself.

End state:
- `https://garage.duski.org` → Cloudflare → Tunnel → NAS Docker container
- First visit on iPhone: enter your email, get a 6-digit code, then **register a passkey**
- Every subsequent visit: tap the page → Face ID prompt → in

---

## Prerequisites

- `duski.org` already added to Cloudflare (DNS hosted there)
- A Cloudflare Zero Trust team set up (free for up to 50 users — sign up at one.dash.cloudflare.com if you haven't)
- The NAS is reachable from itself on `localhost:3000` after we deploy the container (covered in `nas-deploy.md`)

---

## Step 1 — Install `cloudflared` on the NAS

The Tunnel daemon connects outbound from your NAS to Cloudflare's edge. No inbound firewall changes needed.

Easiest path on a Synology NAS: run `cloudflared` as another Docker container in the same Portainer stack as the app. We'll set this up in the deploy guide. For now, just create the Tunnel definition in Cloudflare so we have a token to use.

---

## Step 2 — Create the Tunnel in the Zero Trust dashboard

1. Go to **Zero Trust → Networks → Tunnels** (`one.dash.cloudflare.com/<account>/networks/tunnels`).
2. Click **Create a tunnel** → choose **Cloudflared** → **Next**.
3. Name it `home-nas` (or anything memorable) → **Save tunnel**.
4. Cloudflare shows you an install command. **Copy the token** — the long string after `--token`. You'll paste this into the docker-compose later.
5. Skip the install command page (we're using Docker, not their installer) → **Next**.
6. On the **Public Hostname** page:
   - Subdomain: `garage`
   - Domain: `duski.org`
   - Service Type: `HTTP`
   - URL: `automotive:3000` (this is the Docker service name we'll use in compose)
7. **Save tunnel**.

Cloudflare automatically creates a CNAME record `garage.duski.org → <tunnel-id>.cfargotunnel.com`. No manual DNS work needed.

---

## Step 3 — Create the Access application

This is what gates the app behind Face ID.

1. **Zero Trust → Access → Applications → Add an application**.
2. Choose **Self-hosted**.
3. Application configuration:
   - **Application name**: `Automotive`
   - **Session duration**: `1 month` (long-lived = fewer Face ID prompts)
   - **Application domain**:
     - Subdomain: `garage`
     - Domain: `duski.org`
4. Scroll down to **Identity providers**: leave the default **One-time PIN** enabled (this sends a 6-digit code to your email — we'll use it once to bootstrap, then never again because passkeys take over).
5. Click **Next** → **Add policy**:
   - **Policy name**: `Owner only`
   - **Action**: `Allow`
   - **Configure rules → Include → Emails**: `jhill@mercyhillchurch.com`
6. Click **Next** → leave the rest as defaults → **Add application**.
7. After creation, open the app → **Settings → Overview** → copy the **Application Audience (AUD) Tag**. You'll set this as `CF_ACCESS_AUD` in the container env.
8. Also note your team domain (top of the Zero Trust dashboard): looks like `<something>.cloudflareaccess.com`. That's `CF_ACCESS_TEAM_DOMAIN`.

---

## Step 4 — Enable WebAuthn / passkeys (the Face ID part)

Cloudflare Access supports WebAuthn out of the box once you turn it on at the team level.

1. **Zero Trust → Settings → Authentication → Login methods → Add new**.
2. Choose **WebAuthn**.
3. **Name**: `Passkey`
4. Save. It's now an additional login option alongside the email PIN.

> **Note:** Passkeys must be _registered_ before they can be used. The first time you log in, you'll use the email PIN. Cloudflare Access will then prompt you to register a passkey for next time. On iPhone, that prompt triggers the iOS passkey UI → Face ID confirmation → key stored in iCloud Keychain. From then on, sign-in is just a Face ID tap.

---

## Step 5 — Wire up the env vars

In the app's runtime env (Portainer stack environment variables):

```env
CF_ACCESS_TEAM_DOMAIN=<your-team>.cloudflareaccess.com
CF_ACCESS_AUD=<the-AUD-tag-from-step-3.7>
DISABLE_AUTH=false
```

The middleware (`src/middleware.ts`) verifies every request's CF Access JWT against these values. If anyone hits the origin directly (bypassing Cloudflare), they get a 401 — Access JWTs are signed by keys only Cloudflare holds.

---

## Step 6 — First login

1. Open `https://garage.duski.org` on your iPhone.
2. Cloudflare Access page appears → enter `jhill@mercyhillchurch.com` → **Send me a code**.
3. Get the 6-digit code from email, paste it.
4. After successful login, Cloudflare prompts: "Register a security key" → tap → iOS passkey sheet appears → **Face ID** → Done.
5. Log out, then revisit `garage.duski.org` → choose **Passkey** → **Face ID** → in.
6. Add the page to your Home Screen so it opens like an app.

---

## Troubleshooting

- **401 from the app immediately after login**: the AUD or team domain is wrong. Double-check both env vars match exactly (no `https://`, no trailing slash on team domain).
- **CF Access page never appears, app shows 401 directly**: the Tunnel is sending traffic but Access isn't applied to the hostname. Confirm in **Access → Applications** that the app's domain matches `garage.duski.org` exactly.
- **Tunnel shows "down" in dashboard**: the `cloudflared` container can't reach Cloudflare. Check it has internet egress and the tunnel token env var is set correctly.
