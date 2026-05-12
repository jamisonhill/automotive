import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  verifySession,
} from "@/lib/session-edge";

/*
 * Server-only session helpers — cookie set/clear + DB-backed session lookup.
 *
 * Edge code (middleware) must import from `@/lib/session-edge` instead,
 * which omits the Prisma dependency.
 */

// Re-export the edge primitives so callers usually only need one import.
export {
  SESSION_COOKIE_NAME,
  signSession,
  verifySession,
} from "@/lib/session-edge";

/**
 * Issue a session cookie on the current response. Called by signUp + signIn
 * server actions after they've verified credentials.
 */
export async function setSessionCookie(userId: string): Promise<void> {
  const token = await signSession(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    // Prod runs behind Cloudflare Tunnel → always HTTPS. Dev runs on
    // http://localhost so the cookie must be non-secure to be sent at all.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Clear the session cookie. Called by signOut.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
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
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
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
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
