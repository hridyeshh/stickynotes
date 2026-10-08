"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/session";

/** Mints a single-use code for the extension's PKCE challenge (/extension/connect). */
export async function createExtensionCode(challenge: string): Promise<{ code?: string; error?: string }> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  try {
    return await api<{ code: string }>("/api/v1/extension/codes", { method: "POST", token, body: { code_challenge: challenge } });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return { error: "Your session expired." };
    console.error("extension code failed", e);
    return { error: "We couldn't reach stickynotes." };
  }
}

export async function signOut() {
  const jar = await cookies();
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  // Revoke it server-side too, so the refresh token is dead even if a copy leaked.
  if (refresh) await api("/api/v1/auth/logout", { method: "POST", body: { refresh_token: refresh } }).catch(() => {});
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  redirect("/");
}
