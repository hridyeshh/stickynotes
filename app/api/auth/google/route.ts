import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_COOKIE, safeNext } from "@/lib/session";

// Starts Google sign-in: authorization-code flow with state (CSRF) and PKCE.
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not set");

  const state = randomToken();
  const verifier = randomToken();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));

  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: new URL("/api/auth/callback/google", req.url).toString(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: base64url(new Uint8Array(digest)),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  const res = NextResponse.redirect(google);
  res.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, verifier, next: safeNext(req.nextUrl.searchParams.get("next")) }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 600,
  });
  return res;
}

function randomToken() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
