import { NextResponse, type NextRequest } from "next/server";

import { extractAccessJwt, verifyAccessJwt } from "@/lib/cf-access";

/*
 * Edge proxy — runs before every matched request.
 * (Next.js 16 renamed this convention from "middleware" to "proxy"; same idea.)
 *
 * In production, every request must carry a valid Cloudflare Access JWT.
 * If verification fails we return 401 (no redirect — Cloudflare itself
 * handles the auth UI before requests ever reach us).
 *
 * For local dev, set DISABLE_AUTH=true in .env.local to bypass.
 *
 * IMPORTANT: this runs in the edge runtime, so anything imported here must
 * be edge-compatible. `jose` is — `jsonwebtoken` would not be.
 */

export async function proxy(req: NextRequest) {
  // Dev-only bypass. The env var is read at runtime; setting it to "true"
  // in .env.local lets you run `npm run dev` without CF.
  if (process.env.DISABLE_AUTH === "true") {
    return NextResponse.next();
  }

  const token = extractAccessJwt(req);
  if (!token) {
    return new NextResponse("Unauthorized: missing Cloudflare Access token", {
      status: 401,
    });
  }

  try {
    const verified = await verifyAccessJwt(token);
    // Pass the verified email through to downstream handlers via a request
    // header. Server components / API routes can read this with
    // `headers().get("x-user-email")`.
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-user-email", verified.email);
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch (err) {
    // Verification can fail for: expired token, wrong audience, bad signature,
    // missing JWKS key, network error fetching JWKS. All are 401.
    const message = err instanceof Error ? err.message : "verification failed";
    return new NextResponse(`Unauthorized: ${message}`, { status: 401 });
  }
}

// Match everything except Next internals and static assets.
// The PWA manifest and icons are public (no auth) so users can install the app.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/.*|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
