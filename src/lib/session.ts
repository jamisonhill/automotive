import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";

import { prisma } from "@/lib/db";

/*
 * Session helpers — phase 9 auth.
 *
 * Sessions are signed JWTs (HS256) stored in an httpOnly cookie. Edge
 * runtime can verify the cookie without touching the DB (just signature +
 * expiry), which is what `src/proxy.ts` will do in 9c. Server components
 * use `getSession()` to also load the full User row.
 *
 * Why JWT and not just a random opaque token + DB lookup?
 * - The proxy middleware runs in the edge runtime where Prisma can't run.
 *   Verifying a signed cookie there is the simplest gate. Trade-off:
 *   revocation isn't instant — a stolen cookie stays valid until expiry.
 *   For a personal app shared with friends, that's fine.
 *
 * Cookie shape:
 *   name        auto_session
 *   value       JWT (sub = userId, exp = +30 days)
 *   httpOnly    true   — JS in the page can't read it
 *   secure      true in prod (HTTPS); false in dev for localhost
 *   sameSite    lax    — sent on top-level navigations (login form post),
 *                        blocked on cross-site fetches
 *   path        /      — applies everywhere
 *   maxAge      30 days
 */

const COOKIE_NAME = "auto_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

// Encoded once per module load. The secret comes from the env at boot.
function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    // Fail loud — running the app with a missing/weak secret would silently
    // mint forgeable sessions. The check fires at the first call (request
    // time), so dev never has to set it for build-only operations.
    throw new Error(
      "SESSION_SECRET must be set in env and be at least 32 chars. " +
        "Generate one with: openssl rand -base64 48"
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Sign a session token for the given userId. Used by login + signup.
 * Returns the JWT string — callers set it as a cookie.
 */
export async function signSession(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

/**
 * Verify a session token. Returns the userId on success, null on any
 * failure (expired, bad signature, malformed). Never throws.
 *
 * Edge-safe: uses jose, no Node-only APIs.
 */
export async function verifySession(
  token: string
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    if (!userId) return null;
    return { userId };
  } catch {
    return null;
  }
}

/**
 * Issue a session cookie on the current response. Called by signUp + signIn
 * server actions after they've verified credentials.
 */
export async function setSessionCookie(userId: string): Promise<void> {
  const token = await signSession(userId);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    // Prod runs behind Cloudflare Tunnel → always HTTPS. Dev runs on
    // http://localhost so the cookie must be non-secure to be sent at all.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

/**
 * Clear the session cookie. Called by signOut.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Read the session cookie and load the User row. Returns null if the cookie
 * is missing, invalid, expired, or points to a user that no longer exists.
 *
 * Wrapped in React.cache so it's a single DB hit per request even if called
 * from multiple server components on the same page.
 */
export const getSession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const verified = await verifySession(token);
  if (!verified) return null;

  const user = await prisma.user.findUnique({
    where: { id: verified.userId },
    select: {
      id: true,
      email: true,
      createdAt: true,
      // never return passwordHash — keeps it from accidentally leaking
      // into a server component prop and over the wire.
    },
  });

  if (!user) return null;
  return { userId: user.id, user };
});

/**
 * Require a session — throws a redirect to /login if there isn't one.
 * Use in server components and route handlers that need a guaranteed user.
 *
 * Pages that need to render an unauthenticated state (e.g. /login itself)
 * should call getSession() directly and branch on null.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Cookie name — exported so the middleware can read it directly without
 * importing the whole module's session-cache machinery.
 */
export const SESSION_COOKIE_NAME = COOKIE_NAME;
