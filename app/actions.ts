"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/session";

export async function signOut() {
  const jar = await cookies();
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  // Revoke it server-side too, so the refresh token is dead even if a copy leaked.
  if (refresh) await api("/api/v1/auth/logout", { method: "POST", body: { refresh_token: refresh } }).catch(() => {});
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  redirect("/");
}
