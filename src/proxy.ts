import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME, verifySession } from "@/lib/session-edge";

/*
 * Edge proxy — runs before every matched request.
 * (Next.js 16 renamed this convention from "middleware" to "proxy"; same idea.)
 *
 * Phase 9c: replaced Cloudflare Access JWT verification with our own
 * session cookie. Every request to a gated route must carry a valid
 * `auto_session` cookie. Missing or invalid → redirect to /login.
 *
 * Public paths (no session required):
 *   - /login, /signup (the unauthenticated screens themselves)
 *   - Static assets and PWA manifest (handled by the matcher exclusion below)
 *
 * IMPORTANT: this runs in the edge runtime, so the only allowed imports
 * are edge-compatible. `jose` is. `@prisma/client` is NOT — that's why we
 * import from `@/lib/session-edge` (jose-only) rather than `@/lib/session`.
 */

// Paths that render their own unauthenticated UI. These must be reachable
// without a session so users can sign up / log in. Anything outside this
// list demands a valid session cookie.
const PUBLIC_PATHS = new Set(["/login", "/signup"]);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Strip any client-supplied `x-user-id` BEFORE doing anything else.
  //
  // This header is a trusted signal: `requireUserId()` in lib/session.ts
  // returns it verbatim without re-verifying the JWT. Only this proxy may
  // set it, and only after the session cookie checks out below.
  //
  // Why "before anything else" matters: the public-path branch used to
  // return `NextResponse.next()` with the original headers intact. Because
  // Next.js server actions dispatch by `Next-Action` id and can be POSTed to
  // ANY route, a request to /login carrying `x-user-id: <someone-else>`
  // reached the action layer with that header still attached — and ran as
  // that user with no session at all. Deleting it here, ahead of every
  // early return, closes that path.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.delete("x-user-id");

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return redirectToLogin(req);
  }

  const verified = await verifySession(token);
  if (!verified) {
    // Bad or expired cookie. Clear it so the browser stops sending it,
    // then redirect to /login.
    const response = redirectToLogin(req);
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  // Forward the userId to downstream handlers via a request header so
  // server components don't have to re-verify the JWT. Safe to set now:
  // any inbound value was deleted above, and the cookie is verified.
  requestHeaders.set("x-user-id", verified.userId);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function redirectToLogin(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

// Match everything except Next internals and static assets.
// The PWA manifest and icons are public (no auth) so users can install the app.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/.*|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
