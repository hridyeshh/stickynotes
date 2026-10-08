import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/lib/api";
import { OAUTH_COOKIE, safeNext, sessionCookies, type Session } from "@/lib/session";

// Finishes Google sign-in: check state, swap the code for Google's ID token, then let
// the API verify that token and start our session.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const saved = readSaved(req.cookies.get(OAUTH_COOKIE)?.value);
  const done = (to: string) => {
    const res = NextResponse.redirect(new URL(to, req.url));
    res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth" });
    return res;
  };

  if (q.get("error")) return done("/signin?error=cancelled");
  const code = q.get("code");
  if (!saved || !code || q.get("state") !== saved.state) return done("/signin?error=expired");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: saved.verifier,
      redirect_uri: new URL("/api/auth/callback/google", req.url).toString(),
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  });
  const google = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !google.id_token) {
    console.error("google token exchange failed", tokenRes.status, google.error);
    return done("/signin?error=google");
  }

  const session = await api<Session>("/api/v1/auth/google", { method: "POST", body: { id_token: google.id_token } }).catch((e) => {
    console.error("api sign-in failed", e);
    return null;
  });
  if (!session) return done("/signin?error=server");

  const res = done(safeNext(saved.next));
  for (const c of sessionCookies(session)) res.cookies.set(c);
  return res;
}

function readSaved(raw?: string): { state: string; verifier: string; next: string } | null {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
