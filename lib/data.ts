// Reads from the API for signed-in pages, as the signed-in user. Server-side only.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { ACCESS_COOKIE, type User } from "@/lib/session";

/** GET /me: the user, and when their extension last checked in (null: none connected). suggestions: reading suggestions
 *  on or off, null until they decide; an API from before phase 6 leaves it out, and then nothing offers them. */
export type Me = User & { extension_seen_at: string | null; suggestions?: boolean | null };

/** GETs an API path with the session's token; a dead session goes to sign-in. */
export async function load<T>(path: string): Promise<T> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  try {
    return await api<T>(path, { token });
  } catch (e) {
    // Middleware refreshed the token, so a 401 here means the account is gone.
    if (e instanceof ApiError && e.status === 401) redirect("/signin");
    throw e;
  }
}
