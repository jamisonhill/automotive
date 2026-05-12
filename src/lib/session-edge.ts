import { SignJWT, jwtVerify } from "jose";

/*
 * Edge-safe session helpers.
 *
 * Anything imported by `src/proxy.ts` must be edge-runtime compatible —
 * no `prisma`, no Node-only APIs (fs, crypto.createCipher, etc.). This file
 * contains just the JWT sign/verify code so the middleware can use it
 * without dragging Prisma into the edge bundle.
 *
 * Server components and server actions should import from `@/lib/session`
 * instead, which re-exports these and adds the cookie + DB-aware helpers.
 */

export const SESSION_COOKIE_NAME = "auto_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    // Fail loud — running with a missing or weak secret would silently
    // mint forgeable sessions. Caught at first call (request time).
    throw new Error(
      "SESSION_SECRET must be set in env and be at least 32 chars. " +
        "Generate one with: openssl rand -base64 48"
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Sign a session token for the given userId.
 * Used by login + signup server actions.
 */
export async function signSession(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

/**
 * Verify a session token. Returns the userId on success, null on any
 * failure (expired, bad signature, malformed). Never throws.
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
