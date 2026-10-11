import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/lib/api";
import { ACCESS_COOKIE, REFRESH_COOKIE, secondsLeft, sessionCookies, type Session } from "@/lib/session";

// Runs only on pages that need a signed-in user (see matcher): keeps the access token
// fresh and sends everyone else to /signin.
export async function middleware(req: NextRequest) {
  // Prefetches of dynamic pages only fetch shared layout. Letting them through also
  // keeps them out of refresh-token rotation, where parallel requests would race.
  if (req.headers.has("next-router-prefetch")) return NextResponse.next();

  let access = req.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;

  let fresh: Session | null = null;
  if (refresh && !(access && secondsLeft(access) > 30)) {
    // ponytail: two tabs refreshing in the same instant → one loses the rotation and
    // lands on /signin. Add a short reuse window to the API's refresh if that shows up.
    fresh = await api<Session>("/api/v1/auth/refresh", { method: "POST", body: { refresh_token: refresh } }).catch(() => null);
    if (fresh) access = fresh.access_token;
  }

  if (!access || secondsLeft(access) <= 0) {
    const next = req.nextUrl.pathname + req.nextUrl.search;
    return NextResponse.redirect(new URL(`/signin?next=${encodeURIComponent(next)}`, req.url));
  }
  if (!fresh) return NextResponse.next();

  // Hand the new tokens to this request's server components as well as the browser.
  req.cookies.set(ACCESS_COOKIE, fresh.access_token);
  req.cookies.set(REFRESH_COOKIE, fresh.refresh_token);
  const res = NextResponse.next({ request: { headers: req.headers } });
  for (const c of sessionCookies(fresh)) res.cookies.set(c);
  return res;
}

export const config = {
  // Every signed-in page. /s (shared topics) and /sample are public.
  matcher: ["/library/:path*", "/extension/:path*", "/t/:path*", "/settings", "/onboarding", "/export"],
};
