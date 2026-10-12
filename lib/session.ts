// Session cookies and helpers. Middleware imports this, so it stays edge-safe:
// no next/headers, no Node APIs.

export const ACCESS_COOKIE = "sn_access";
export const REFRESH_COOKIE = "sn_refresh";
/** Readable by page script and holds no secret: it only tells static public pages that someone is signed in,
 *  so their header offers the library instead of Sign in (see app/layout.tsx). */
export const SIGNED_IN_COOKIE = "sn_in";
/** Holds state + PKCE verifier between /api/auth/google and its callback. */
export const OAUTH_COOKIE = "sn_oauth";

export type User = { id: string; email: string; name: string; avatar_url: string };
export type Session = { access_token: string; refresh_token: string; expires_in: number; user: User };

const SIXTY_DAYS = 60 * 24 * 60 * 60; // the API's refresh-token lifetime

/** Both tokens as HttpOnly cookies, plus the signed-in hint. The access cookie outlives its JWT on purpose:
 *  middleware reads the JWT's own expiry and swaps in a fresh one. */
export function sessionCookies(s: Session) {
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: SIXTY_DAYS };
  return [
    { name: ACCESS_COOKIE, value: s.access_token, ...opts },
    { name: REFRESH_COOKIE, value: s.refresh_token, ...opts },
    { name: SIGNED_IN_COOKIE, value: "1", ...opts, httpOnly: false },
  ];
}

/** Seconds until a JWT expires; negative when expired or unreadable. Unverified: it only
 *  decides when to refresh. The API checks the signature. */
export function secondsLeft(jwt: string): number {
  try {
    const payload = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp - Date.now() / 1000 : -1;
  } catch {
    return -1;
  }
}

/** Where to land after sign-in: same-site paths only ("//x" and "/\x" leave the site). */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/library";
}
