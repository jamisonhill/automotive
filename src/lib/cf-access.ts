import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

/*
 * Cloudflare Access JWT verification.
 *
 * When a user passes through Cloudflare Access, every request to our origin
 * carries a `CF-Access-Jwt-Assertion` header (or a `CF_Authorization` cookie).
 * This is a signed JWT proving the user was authenticated by CF.
 *
 * We must verify:
 *   1. Signature against Cloudflare's published JWKS for our team
 *   2. issuer matches https://<team>.cloudflareaccess.com
 *   3. audience matches our application's AUD tag
 *
 * If any check fails, we reject the request — that means someone is hitting
 * the origin directly (bypassing CF Tunnel/Access), which should never happen
 * in production but is a critical thing to guard against.
 *
 * Reference: https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
 */

// Cache the JWKS resolver across requests — jose handles refresh internally
// based on cache-control headers from Cloudflare.
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(teamDomain: string) {
  if (jwksCache) return jwksCache;
  const jwksUrl = new URL(
    `https://${teamDomain}/cdn-cgi/access/certs`
  );
  jwksCache = createRemoteJWKSet(jwksUrl);
  return jwksCache;
}

export interface VerifiedAccessJwt {
  email: string;
  sub: string;
  payload: JWTPayload;
}

/**
 * Verify a Cloudflare Access JWT and return the verified claims.
 * Throws if the token is missing, expired, malformed, or signed by a key
 * outside our team's JWKS.
 */
export async function verifyAccessJwt(token: string): Promise<VerifiedAccessJwt> {
  const teamDomain = process.env.CF_ACCESS_TEAM_DOMAIN;
  const aud = process.env.CF_ACCESS_AUD;

  // Fail closed: if the env vars aren't set, we cannot verify anything,
  // so we must reject. The only escape hatch is DISABLE_AUTH=true (dev only).
  if (!teamDomain || !aud) {
    throw new Error(
      "CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD must be set in production"
    );
  }

  const { payload } = await jwtVerify(token, getJwks(teamDomain), {
    issuer: `https://${teamDomain}`,
    audience: aud,
  });

  // CF Access always populates email for human users; service tokens use a
  // different shape. We only support human users here.
  const email = typeof payload.email === "string" ? payload.email : "";
  if (!email) {
    throw new Error("Access JWT missing email claim");
  }

  return {
    email,
    sub: typeof payload.sub === "string" ? payload.sub : "",
    payload,
  };
}

/**
 * Extract the Access JWT from a request's headers or cookies.
 * Cloudflare sends both; we accept either. Header is preferred for API calls.
 */
export function extractAccessJwt(req: Request): string | null {
  const headerToken = req.headers.get("cf-access-jwt-assertion");
  if (headerToken) return headerToken;

  // Cookie fallback — parse manually since middleware runs in edge runtime.
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
